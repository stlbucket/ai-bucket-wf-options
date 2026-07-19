select 1/count(*) from pg_roles where rolname = 'n8n_worker';
select 1/count(*) from pg_policies where schemaname = 'n8n' and tablename = 'workflow_run' and policyname = 'view_runs_super_admin';
select pg_catalog.has_function_privilege('n8n_worker', 'n8n_fn.begin_run(citext, text, jsonb, uuid)', 'execute');
select pg_catalog.has_function_privilege('n8n_worker', 'app_api.raise_exception(citext)', 'execute');
