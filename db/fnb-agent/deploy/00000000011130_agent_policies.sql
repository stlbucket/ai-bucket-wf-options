-- Deploy fnb-agent:00000000011130_agent_policies to pg

--- agent_api policies
grant usage on schema agent_api to anon, authenticated, service_role;
grant all on all routines in schema agent_api to anon, authenticated, service_role;
alter default privileges for role postgres in schema agent_api grant all on routines to anon, authenticated, service_role;

--- agent policies (reads are RLS-scoped; writes happen only via agent_fn SECURITY DEFINER)
grant usage on schema agent to anon, authenticated, service_role;
grant select on all tables in schema agent to anon, authenticated, service_role;
alter default privileges for role postgres in schema agent grant select on tables to anon, authenticated, service_role;

------------------------------------------------------------------------ RLS
alter table agent.workflow_run enable row level security;
-- Super admins see tenant-scoped runs of their (anchor) tenant plus the tenant-less rows
-- (dataset syncs are anchor-wide, tenant_id IS NULL).
CREATE POLICY view_runs_super_admin ON agent.workflow_run
  FOR SELECT
  USING (
    jwt.has_permission('p:app-admin-super', tenant_id)
    OR (tenant_id IS NULL AND jwt.has_permission('p:app-admin-super'))
  );
-- no insert/update/delete policies: writes happen only inside agent_fn (SECURITY DEFINER)
-- over the agent_worker connection.

------------------------------------------------------------------------ agent_worker role
-- The service-level login role agent-app's tool handlers + harness connect as. NOINHERIT,
-- least-privilege: it can execute exactly the granted _fn surface — never PostGraphile, never
-- authenticator/authenticated. Idempotent guard; the password flows from AGENT_WORKER_PG_PASSWORD
-- via sqitch deploy --set agent_worker_password=… (psql vars do not interpolate inside DO $$
-- bodies, hence the separate ALTER ROLE).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent_worker') THEN
    CREATE ROLE agent_worker LOGIN NOINHERIT;
  END IF;
END
$$;
ALTER ROLE agent_worker WITH LOGIN NOINHERIT PASSWORD :'agent_worker_password';

grant usage on schema agent to agent_worker;
grant usage on schema agent_fn to agent_worker;
grant execute on all functions in schema agent_fn to agent_worker;
alter default privileges for role postgres in schema agent_fn grant execute on functions to agent_worker;

-- Exerciser demo: the DB-raised-exception path (app_api.raise_exception — SECURITY INVOKER,
-- no permission gate, just raises). This grant lives HERE, not in fnb-app: fnb-app deploys
-- before the agent_worker role exists on a fresh rebuild.
grant usage on schema app_api to agent_worker;
grant execute on function app_api.raise_exception(citext) to agent_worker;
