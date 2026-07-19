select has_function_privilege('todo_api.create_todo(citext, todo_fn.create_todo_options)', 'execute');
select has_function_privilege('todo_fn.create_todo(citext, todo_fn.create_todo_options, uuid)', 'execute');
