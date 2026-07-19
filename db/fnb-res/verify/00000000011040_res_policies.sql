select 1/(select count(*)::int from pg_policies
  where schemaname = 'res' and tablename = 'resource' and policyname = 'resource_select');
select 1/(select count(*)::int from pg_policies
  where schemaname = 'res' and tablename = 'module_permission' and policyname = 'view_module_permission');
