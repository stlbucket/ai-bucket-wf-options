select pg_catalog.has_schema_privilege('n8n', 'usage');
select id, workflow_key, n8n_execution_id, tenant_id, status, input_data, result_data, error, started_at, finished_at
from n8n.workflow_run
where false;
