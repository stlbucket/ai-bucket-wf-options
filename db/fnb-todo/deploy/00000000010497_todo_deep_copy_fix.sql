-----------------------------------------------
-- script  fix deep_copy_todo options row arity (latent bug exposed by pgTAP)
--         the original passed a 5-field row(...) (trailing null for the commented-out
--         location option) into the 4-attribute todo_fn.create_todo_options — every
--         deep copy (make_template_from_todo / make_todo_from_template) raised
--         "cannot cast type record to todo_fn.create_todo_options".
-----------------------------------------------
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
      )::todo_fn.create_todo_options
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
