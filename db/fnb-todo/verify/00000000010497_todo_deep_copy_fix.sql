-- verify deep_copy_todo exists (body fix — structural check only)
SELECT has_function_privilege('todo_fn.deep_copy_todo(uuid, uuid, boolean, uuid)', 'execute');
