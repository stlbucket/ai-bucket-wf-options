-- verify todo_assignee table, unique constraint, RLS policy, indexes
SELECT 1/COUNT(*) FROM information_schema.tables
  WHERE table_schema = 'todo' AND table_name = 'todo_assignee';
SELECT 1/COUNT(*) FROM pg_constraint
  WHERE conname = 'uq_todo_assignee';
SELECT 1/COUNT(*) FROM pg_policies
  WHERE schemaname = 'todo' AND tablename = 'todo_assignee' AND policyname = 'manage_all_for_tenant';
SELECT 1/COUNT(*) FROM pg_indexes
  WHERE indexname = 'idx_todo_todo_assignee_todo_id';
SELECT 1/COUNT(*) FROM pg_indexes
  WHERE indexname = 'idx_todo_todo_assignee_resident_urn';
SELECT 1/COUNT(*) FROM pg_indexes
  WHERE indexname = 'idx_todo_todo_assignee_tenant_id';
-- RLS actually enabled
SELECT 1/(CASE WHEN relrowsecurity THEN 1 ELSE 0 END)
  FROM pg_class WHERE oid = 'todo.todo_assignee'::regclass;
