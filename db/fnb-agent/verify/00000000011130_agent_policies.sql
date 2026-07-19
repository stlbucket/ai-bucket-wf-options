select 1/count(*) from pg_roles where rolname = 'agent_worker';
select 1/count(*) from pg_policies where schemaname = 'agent' and tablename = 'workflow_run' and policyname = 'view_runs_super_admin';
select pg_catalog.has_function_privilege('agent_worker', 'agent_fn.begin_run(citext, jsonb, uuid, text)', 'execute');
select pg_catalog.has_function_privilege('agent_worker', 'app_api.raise_exception(citext)', 'execute');
