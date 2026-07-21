-- Deploy fnb-n8n:00000000011230_n8n_policies to pg

--- n8n_api policies
grant usage on schema n8n_api to anon, authenticated, service_role;
grant all on all routines in schema n8n_api to anon, authenticated, service_role;
alter default privileges for role postgres in schema n8n_api grant all on routines to anon, authenticated, service_role;

--- n8n policies (reads are RLS-scoped; writes happen only via n8n_fn SECURITY DEFINER)
grant usage on schema n8n to anon, authenticated, service_role;
grant select on all tables in schema n8n to anon, authenticated, service_role;
alter default privileges for role postgres in schema n8n grant select on tables to anon, authenticated, service_role;

------------------------------------------------------------------------ RLS
alter table n8n.workflow_run enable row level security;
-- Super admins see tenant-scoped runs of their (anchor) tenant plus the tenant-less rows
-- (mirrors agent.workflow_run's view_runs_super_admin policy).
CREATE POLICY view_runs_super_admin ON n8n.workflow_run
  FOR SELECT
  USING (
    jwt.has_permission('p:app-admin-super', tenant_id)
    OR (tenant_id IS NULL AND jwt.has_permission('p:app-admin-super'))
  );
-- no insert/update/delete policies: writes happen only inside n8n_fn (SECURITY DEFINER)
-- over the n8n_worker connection.

------------------------------------------------------------------------ n8n_worker role
-- The service-level login role n8n's Postgres credential connects as. NOINHERIT,
-- least-privilege: it can execute exactly the granted fn surface — never PostGraphile, never
-- authenticator/authenticated. Idempotent guard; the password flows from N8N_WORKER_PG_PASSWORD
-- via sqitch deploy --set n8n_worker_password=… (psql vars do not interpolate inside DO $$
-- bodies, hence the separate ALTER ROLE).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n_worker') THEN
    CREATE ROLE n8n_worker LOGIN NOINHERIT;
  END IF;
END
$$;
ALTER ROLE n8n_worker WITH LOGIN NOINHERIT PASSWORD :'n8n_worker_password';

grant usage on schema n8n to n8n_worker;
grant usage on schema n8n_fn to n8n_worker;
grant execute on all functions in schema n8n_fn to n8n_worker;
alter default privileges for role postgres in schema n8n_fn grant execute on functions to n8n_worker;

-- exerciser demo: the DB-raised-exception path (app_api.raise_exception — SECURITY
-- INVOKER, no permission gate, just raises). This grant lives HERE, not in fnb-app: fnb-app
-- deploys before the n8n_worker role exists on a fresh rebuild (same lesson as agent_worker).
grant usage on schema app_api to n8n_worker;
grant execute on function app_api.raise_exception(citext) to n8n_worker;
