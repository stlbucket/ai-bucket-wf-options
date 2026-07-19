select pg_catalog.has_schema_privilege('n8n_fn', 'usage');
select 'n8n_fn.begin_run'::regproc;
select 'n8n_fn.complete_run'::regproc;
select 'n8n_fn.error_run'::regproc;
select 'n8n_fn.error_run_by_execution'::regproc;
select 'n8n_fn.running_count'::regproc;
select 'n8n_fn.dataset_sync_busy'::regproc;
