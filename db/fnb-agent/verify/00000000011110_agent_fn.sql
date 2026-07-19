select pg_catalog.has_schema_privilege('agent_fn', 'usage');
select 'agent_fn.begin_run'::regproc;
select 'agent_fn.attach_session'::regproc;
select 'agent_fn.complete_run'::regproc;
select 'agent_fn.error_run'::regproc;
select 'agent_fn.running_count'::regproc;
select 'agent_fn.sweep_orphaned_runs'::regproc;
