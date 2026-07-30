-----------------------------------------------
-- script  multi-assignee functions + search filter + data migration
--         (drops todo.todo.resident_urn — assignment lives in todo.todo_assignee)
-----------------------------------------------

---------------------------------------------- search_todos_options + assigned_to_resident_urn
alter type todo_fn.search_todos_options add attribute assigned_to_resident_urn text;

---------------------------------------------- search_todos (assignee filter)
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
    and (
      _options.assigned_to_resident_urn is null
      or exists (
        select 1 from todo.todo_assignee ta
        where ta.todo_id = t.id
          and ta.resident_urn = _options.assigned_to_resident_urn
      )
    )
    ;
  end;
  $$;

---------------------------------------------- create_todo (new todos start unassigned)
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

---------------------------------------------- add_todo_assignee
CREATE OR REPLACE FUNCTION todo_api.add_todo_assignee(_todo_id uuid, _resident_urn text)
  RETURNS todo.todo_assignee
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval todo.todo_assignee;
  BEGIN
    if jwt.has_permission('p:todo') = false then
      raise exception '30000: PERMISSION DENIED';
    end if;

    _retval := todo_fn.add_todo_assignee(
      _todo_id
      ,_resident_urn
      ,jwt.resident_id()::uuid
    );
    return _retval;
  end;
  $$;

CREATE OR REPLACE FUNCTION todo_fn.add_todo_assignee(
    _todo_id uuid
    ,_resident_urn text
    ,_resident_id uuid
  )
  RETURNS todo.todo_assignee
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _todo todo.todo;
    _actor app.resident;
    _retval todo.todo_assignee;
  BEGIN
    select * into _todo from todo.todo where id = _todo_id;
    if _todo.id is null then
      raise exception '30030: NO TODO FOR ID';
    end if;
    if _todo.is_template = true then
      raise exception '30031: CANNOT ASSIGN TEMPLATE TODO';
    end if;

    select * into _actor from app.resident where id = _resident_id;

    -- idempotent: re-adding keeps the original row (assigned_by / created_at unchanged)
    insert into todo.todo_assignee(
      todo_id
      ,tenant_id
      ,resident_urn
      ,assigned_by_resident_urn
    )
    values(
      _todo.id
      ,_todo.tenant_id
      ,_resident_urn
      ,_actor.urn
    )
    on conflict on constraint uq_todo_assignee do nothing;

    select * into _retval from todo.todo_assignee
    where todo_id = _todo_id and resident_urn = _resident_urn;

    return _retval;
  end;
  $$;

---------------------------------------------- remove_todo_assignee
CREATE OR REPLACE FUNCTION todo_api.remove_todo_assignee(_todo_id uuid, _resident_urn text)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval boolean;
  BEGIN
    if jwt.has_permission('p:todo') = false then
      raise exception '30000: PERMISSION DENIED';
    end if;

    _retval := todo_fn.remove_todo_assignee(_todo_id, _resident_urn);
    return _retval;
  end;
  $$;

CREATE OR REPLACE FUNCTION todo_fn.remove_todo_assignee(_todo_id uuid, _resident_urn text)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  BEGIN
    -- idempotent: removing an absent assignee is a no-op
    delete from todo.todo_assignee
    where todo_id = _todo_id and resident_urn = _resident_urn;

    return true;
  end;
  $$;

---------------------------------------------- drop assign_todo (single-slot overwrite)
drop function todo_api.assign_todo(uuid, text);
drop function todo_fn.assign_todo(uuid, text);

---------------------------------------------- data migration + column drop
-- Existing non-template resident_urn values become assignee rows (what users currently
-- see as "owner"); template values are dropped. assigned_by_resident_urn stays null —
-- the old column recorded no provenance.
insert into todo.todo_assignee (todo_id, tenant_id, resident_urn)
select id, tenant_id, resident_urn
from todo.todo
where resident_urn is not null
  and is_template = false
on conflict do nothing;

drop index todo.idx_todo_todo_resident_urn;
alter table todo.todo drop column resident_urn;
