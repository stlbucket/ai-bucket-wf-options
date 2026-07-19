begin;

drop policy if exists view_runs_super_admin on agent.workflow_run;
alter table agent.workflow_run disable row level security;

revoke all on function app_api.raise_exception(citext) from agent_worker;
revoke usage on schema app_api from agent_worker;
revoke all on all functions in schema agent_fn from agent_worker;
revoke usage on schema agent_fn from agent_worker;
revoke usage on schema agent from agent_worker;

drop role if exists agent_worker;

commit;
