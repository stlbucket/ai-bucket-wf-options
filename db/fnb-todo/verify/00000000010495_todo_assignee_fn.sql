-- verify multi-assignee functions, search attribute, assign_todo + resident_urn gone
SELECT has_function_privilege('todo_api.add_todo_assignee(uuid, text)', 'execute');
SELECT has_function_privilege('todo_fn.add_todo_assignee(uuid, text, uuid)', 'execute');
SELECT has_function_privilege('todo_api.remove_todo_assignee(uuid, text)', 'execute');
SELECT has_function_privilege('todo_fn.remove_todo_assignee(uuid, text)', 'execute');

-- search_todos_options has the new attribute
SELECT 1/COUNT(*) FROM pg_attribute a
  JOIN pg_type t ON t.typrelid = a.attrelid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'todo_fn'
    AND t.typname = 'search_todos_options'
    AND a.attname = 'assigned_to_resident_urn';

-- assign_todo is gone (api + fn)
SELECT 1/(CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END) FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('todo_api', 'todo_fn') AND p.proname = 'assign_todo';

-- todo.todo.resident_urn is gone
SELECT 1/(CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END) FROM information_schema.columns
  WHERE table_schema = 'todo' AND table_name = 'todo' AND column_name = 'resident_urn';
