begin;

drop policy if exists view_runs_super_admin on n8n.workflow_run;
alter table n8n.workflow_run disable row level security;

revoke all on function app_api.raise_exception(citext) from n8n_worker;
revoke usage on schema app_api from n8n_worker;
revoke all on all functions in schema n8n_fn from n8n_worker;
revoke usage on schema n8n_fn from n8n_worker;
revoke usage on schema n8n from n8n_worker;

drop role if exists n8n_worker;

commit;
