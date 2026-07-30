-----------------------------------------------
-- revert  multi-assignee functions + search filter + data migration
-- (re-adds todo.todo.resident_urn; best-effort reverse migration = first assignee
--  per todo by created_at; restores the 00000000010470_todo_fn bodies verbatim)
-----------------------------------------------

---------------------------------------------- re-add the single-slot column + index
alter table todo.todo add column resident_urn text null references res.resource(urn);
create index idx_todo_todo_resident_urn on todo.todo(resident_urn);

-- best-effort reverse migration: first assignee per todo (by created_at) becomes the owner
update todo.todo t
set resident_urn = fa.resident_urn
from (
  select distinct on (todo_id) todo_id, resident_urn
  from todo.todo_assignee
  order by todo_id, created_at
) fa
where fa.todo_id = t.id;

---------------------------------------------- drop the multi-assignee functions
drop function if exists todo_api.add_todo_assignee(uuid, text);
drop function if exists todo_fn.add_todo_assignee(uuid, text, uuid);
drop function if exists todo_api.remove_todo_assignee(uuid, text);
drop function if exists todo_fn.remove_todo_assignee(uuid, text);

---------------------------------------------- restore assign_todo (from 00000000010470_todo_fn)
CREATE OR REPLACE FUNCTION todo_api.assign_todo(_todo_id uuid, _resident_urn text)
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval todo.todo;
  BEGIN
    _retval := todo_fn.assign_todo(_todo_id, _resident_urn);
    return _retval;
  end;
  $$;

CREATE OR REPLACE FUNCTION todo_fn.assign_todo(_todo_id uuid, _resident_urn text)
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _todo todo.todo;
  BEGIN
    update todo.todo set resident_urn = _resident_urn where id = _todo_id returning * into _todo;
    return _todo;
  end;
  $$;

---------------------------------------------- restore create_todo (from 00000000010470_todo_fn)
CREATE OR REPLACE FUNCTION todo_fn.create_todo(
    _name citext
    ,_options todo_fn.create_todo_options
    ,_resident_id uuid
  )
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _ordinal integer;
    _resident app.resident;
    _parent_todo todo.todo;
    _retval todo.todo;
    _id uuid;
  BEGIN
    if _name is null or length(_name) < 3 then
      raise exception '30028: Todo name must be at least 3 characters';
    end if;

    select * into _resident from app.resident where id = _resident_id;
    if _resident.id is null then
      raise exception 'no resident for id: %', _resident_id;
    end if;

    _ordinal := 0;
    if _options.parent_todo_id is not null then
      _ordinal := (select count(*) + 1 from todo.todo where parent_todo_id = _options.parent_todo_id);
      select * into _parent_todo from todo.todo where id = _options.parent_todo_id;
      _options.is_template = _parent_todo.is_template;
    end if;

    if _options.parent_todo_id is not null then
      select * into _parent_todo from todo.todo where id = _options.parent_todo_id;
    end if;

    _id := gen_random_uuid();
    insert into todo.todo(
      id
      ,tenant_id
      ,resident_urn
      ,name
      ,description
      ,parent_todo_id
      ,root_todo_id
      ,ordinal
      ,is_template
    )
    values(
      _id
      ,_resident.tenant_id
      ,_resident.urn
      ,_name
      ,_options.description
      ,_parent_todo.id
      ,coalesce(_parent_todo.root_todo_id, _id)
      ,_ordinal
      ,coalesce(_options.is_template, false)
    )
    returning * into _retval;
    perform res_fn.register_resource(_id, _resident.tenant_id, 'todo', 'todo', _resident_id);

    if _options.parent_todo_id is not null then
      update todo.todo set type = 'milestone' where id = _options.parent_todo_id;

      if _retval.is_template = false then
        perform todo_fn.update_todo_status(
          _todo_id => _retval.id
          ,_status => 'incomplete'
        );
      end if;
    end if;


    return _retval;
  end;
  $$;

---------------------------------------------- restore search_todos (from 00000000010470_todo_fn)
CREATE OR REPLACE FUNCTION todo_fn.search_todos(_options todo_fn.search_todos_options)
  RETURNS setof todo.todo
  LANGUAGE plpgsql
  stable
  SECURITY INVOKER
  AS $$
  DECLARE
    _use_options todo_fn.search_todos_options;
  BEGIN
    -- TODO: add paging options

    return query
    select t.*
    from todo.todo t
    join app.tenant a on a.id = t.tenant_id
    where (
      _options.search_term is null
      or t.name like '%'||_options.search_term||'%'
      or t.description like '%'||_options.search_term||'%'
      or a.name like '%'||_options.search_term||'%'
    )
    and (_options.todo_type is null or t.type = _options.todo_type)
    and (_options.todo_status is null or t.status = _options.todo_status)
    and (coalesce(_options.roots_only, false) = false or t.parent_todo_id is null )
    and (coalesce(_options.is_template, false) =  t.is_template)
    ;
  end;
  $$;

---------------------------------------------- drop the search-options attribute
alter type todo_fn.search_todos_options drop attribute assigned_to_resident_urn;
