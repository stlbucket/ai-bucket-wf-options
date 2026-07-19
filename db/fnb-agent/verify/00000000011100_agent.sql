select pg_catalog.has_schema_privilege('agent', 'usage');
select id, workflow_key, agent_session_id, model, tenant_id, status, input_data, result_data, error, usage, started_at, finished_at
from agent.workflow_run
where false;
