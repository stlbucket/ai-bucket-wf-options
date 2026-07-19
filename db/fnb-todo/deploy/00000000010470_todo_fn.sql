-----------------------------------------------
-- script  todo_fn schema
-----------------------------------------------

create schema if not exists todo_api;

-------------------------------------------------------------------------------- todo-functions
---------------------------------------------- create_todo
CREATE OR REPLACE FUNCTION todo_api.create_todo(
    _name citext
    ,_options todo_fn.create_todo_options
  )
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval todo.todo;
  BEGIN
    if jwt.has_permission('p:todo') = false then
      raise exception '30000: PERMISSION DENIED';
    end if;

    _retval := todo_fn.create_todo(
      _name::citext
      ,_options::todo_fn.create_todo_options
      ,jwt.resident_id()::uuid
    );
    return _retval;
  end;
  $$;

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
    -- _topic msg.topic;
    -- _location_info loc_fn.location_info;
    -- _location loc.location;
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

    -- _topic := msg_fn.upsert_topic(
    --   row(
    --     null::uuid
    --     ,(_name||' topic')::citext
    --     ,null::citext
    --     ,null::msg.topic_status
    --   )::msg_fn.topic_info
    --   ,_todo_resident.resident_id::uuid
    -- );

    -- _location_info := _options.location;
    -- if _location_info.id is null then
    --   if 
    --     _location_info.name is not null 
    --     or _location_info.postal_code is not null 
    --     or (_location_info.lat is not null and _location_info.lon is not null)
    --   then
    --     _location_info.name = coalesce(_location_info.name, _name||' location');
    --     _location := loc_fn.create_location(
    --       _location_info
    --       ,_resident_id
    --     );
    --   else
    --     -- do nothing in this case.  we will not have a location for this todo item.
    --     _location.id = null;
    --   end if;
    -- else
    --   select * into _location from loc.location where id = _location_info.id;
    -- end if;

    if _options.parent_todo_id is not null then
      select * into _parent_todo from todo.todo where id = _options.parent_todo_id;
    end if;

    _id := gen_random_uuid();
    insert into todo.todo(
      id
      ,tenant_id
      ,resident_urn
      -- ,topic_id
      -- ,location_id
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
      -- ,_topic.id
      -- ,_location.id
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

---------------------------------------------- update_todo
CREATE OR REPLACE FUNCTION todo_api.update_todo(
    _todo_id uuid
    ,_name citext
    ,_description citext default null
  )
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval todo.todo;
  BEGIN
    _retval := todo_fn.update_todo(
      _todo_id
      ,_name
      ,_description
    );
    return _retval;
  end;
  $$;

CREATE OR REPLACE FUNCTION todo_fn.update_todo(
    _todo_id uuid
    ,_name citext
    ,_description citext default null
  )
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval todo.todo;
  BEGIN
    update todo.todo set
      name = _name
      ,description = _description
    where id = _todo_id
    returning * into _retval
    ;

    return _retval;
  end;
  $$;

---------------------------------------------- update_todo_status
CREATE OR REPLACE FUNCTION todo_api.update_todo_status(
    _todo_id uuid
    ,_status todo.todo_status
  )
  RETURNS todo.todo
  VOLATILE
  SECURITY INVOKER
  LANGUAGE plpgsql
  AS $function$
  DECLARE
    _todo todo.todo;
  BEGIN
    _todo := todo_fn.update_todo_status(_todo_id, _status);
    return _todo;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION todo_fn.update_todo_status(
    _todo_id uuid
    ,_status todo.todo_status
  )
  RETURNS todo.todo
  VOLATILE
  SECURITY INVOKER
  LANGUAGE plpgsql
  AS $function$
  DECLARE
    _todo todo.todo;
  BEGIN
    select * into _todo from todo.todo where id = _todo_id;
    if _todo.is_template = true then
      raise exception '30029: CANNOT UPDATE STATUS FOR TEMPLATE TODO';
    end if;

    update todo.todo set 
      status = _status
      ,updated_at = current_timestamp
    where id = _todo_id
    returning * into _todo
    ;

    if _todo.parent_todo_id is not null then
      if _status = 'complete' then
        if (select count(*) from todo.todo where parent_todo_id = _todo.parent_todo_id and status = 'incomplete') = 0 then
          -- update todo.todo set status = 'complete' where id = _todo.parent_todo_id;
          perform todo_fn.update_todo_status(_todo.parent_todo_id, 'complete');
        end if; 
      end if;

      if _status = 'incomplete' then
        perform todo_fn.update_todo_status(_todo.parent_todo_id, 'incomplete');
        -- update todo.todo set status = 'incomplete' where id = _todo.parent_todo_id;
      end if;
    end if;
      
    return _todo;
  end;
  $function$
  ;

---------------------------------------------- delete_todo
CREATE OR REPLACE FUNCTION todo_api.delete_todo(_todo_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval boolean;
  BEGIN
    _retval := todo_fn.delete_todo(_todo_id);
    return _retval;
  end;
  $$;

CREATE OR REPLACE FUNCTION todo_fn.delete_todo(_todo_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _parent_child_count integer;
    _todo todo.todo;
  BEGIN
    perform todo_fn.delete_todo(id) from todo.todo where parent_todo_id = _todo_id;
    
    select * into _todo from todo.todo where id = _todo_id;

    if _todo.parent_todo_id is not null then
      _parent_child_count := (select count(*) from todo.todo where parent_todo_id = _todo.parent_todo_id);
    else
      _parent_child_count := -1;
    end if;
    delete from todo.todo where id = _todo_id;
    perform res_fn.archive_resource(_todo_id);

    if _parent_child_count = 1 then
      update todo.todo set type = 'task' where id = _todo.parent_todo_id;
    end if;

    return true;
  end;
  $$;

---------------------------------------------- pin_todo
CREATE OR REPLACE FUNCTION todo_api.pin_todo(_todo_id uuid)
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval todo.todo;
  BEGIN
    _retval := todo_fn.pin_todo(_todo_id);
    return _retval;
  end;
  $$;

CREATE OR REPLACE FUNCTION todo_fn.pin_todo(_todo_id uuid)
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _todo todo.todo;
  BEGIN
    update todo.todo set pinned = true where id = _todo_id returning * into _todo;
    return _todo;
  end;
  $$;

---------------------------------------------- unpin_todo
CREATE OR REPLACE FUNCTION todo_api.unpin_todo(_todo_id uuid)
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval todo.todo;
  BEGIN
    _retval := todo_fn.unpin_todo(_todo_id);
    return _retval;
  end;
  $$;

CREATE OR REPLACE FUNCTION todo_fn.unpin_todo(_todo_id uuid)
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _todo todo.todo;
  BEGIN
    update todo.todo set pinned = false where id = _todo_id returning * into _todo;
    return _todo;
  end;
  $$;

---------------------------------------------- assign_todo
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

---------------------------------------------- search_todos
  CREATE OR REPLACE FUNCTION todo_api.search_todos(_options todo_fn.search_todos_options)
    RETURNS setof todo.todo
    LANGUAGE plpgsql
    stable
    SECURITY INVOKER
    AS $$
    DECLARE
    BEGIN
      return query select * from todo_fn.search_todos(_options);
    end;
    $$;

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

---------------------------------------------- deep_copy_todo
CREATE OR REPLACE FUNCTION todo_api.make_template_from_todo(_todo_id uuid)
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _todo todo.todo;
  BEGIN
    _todo := todo_fn.deep_copy_todo(
      jwt.resident_id()
      ,_todo_id
      ,true
    );

    return _todo;
  end;
  $$;

CREATE OR REPLACE FUNCTION todo_api.make_todo_from_template(_todo_id uuid)
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _todo todo.todo;
  BEGIN
    _todo := todo_fn.deep_copy_todo(
      jwt.resident_id()
      ,_todo_id
      ,false
    );

    return _todo;
  end;
  $$;


CREATE OR REPLACE FUNCTION todo_fn.deep_copy_todo(
    _resident_id uuid
    ,_todo_id uuid
    ,_is_template boolean
    ,_parent_todo_id uuid default null
  )
  RETURNS todo.todo
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _child_id uuid;
    _todo todo.todo;
    _copy todo.todo;
  BEGIN
    select * into _todo from todo.todo where id = _todo_id;

    if _todo_id is null then
      raise exception '30030: NO TODO FOR ID';
    end if;

    _copy := todo_fn.create_todo(
      _resident_id => _resident_id
      ,_name => _todo.name
      ,_options => row(
        _todo.description
        ,_parent_todo_id
        ,'{}'::citext[]
        ,_is_template
        ,null
      )
    );

    for _child_id in
      select id from todo.todo where parent_todo_id = _todo.id
    loop
      perform todo_fn.deep_copy_todo(
        _resident_id
        ,_child_id
        ,_is_template
        ,_copy.id
      );
    end loop;

    return _copy;
  end;
  $$;
-- -------------------------------------- begin_todo_discussion
-- CREATE OR REPLACE FUNCTION todo_api.begin_discussion_todo(
--     _todo_id uuid,
--     _topic_info msg_fn.topic_info
--   ) RETURNS msg.topic
--     LANGUAGE plpgsql VOLATILE
--     AS $$
--   DECLARE
--     _topic msg.topic;
--   BEGIN
--     if jwt.has_all_permissions({'p:discussions','p:todo'}) = false then
--       raise exception 'NOT AUTHORIZED: 30000';
--     end if;

--     _topic_id = _todo_id;
--     _topic := msg_fn.upsert_topic(
--       _topic_info
--       ,jwt.resident_id()
--     );
--     return _topic;
--   end;
--   $$;
