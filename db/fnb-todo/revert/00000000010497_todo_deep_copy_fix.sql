-----------------------------------------------
-- revert  restore the original deep_copy_todo body (from 00000000010470_todo_fn,
--         including the 5-field row(...) arity bug this change fixed)
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
