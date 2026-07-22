-- Deploy fnb-notify:00000000011270_notify_policies to pg

--- notify_api policies
grant usage on schema notify_api to anon, authenticated, service_role;
grant all on all routines in schema notify_api to anon, authenticated, service_role;
alter default privileges for role postgres in schema notify_api grant all on routines to anon, authenticated, service_role;

--- notify policies (reads are RLS-scoped; writes happen only via notify_fn SECURITY DEFINER)
grant usage on schema notify to anon, authenticated, service_role;
grant select on all tables in schema notify to anon, authenticated, service_role;
alter default privileges for role postgres in schema notify grant select on tables to anon, authenticated, service_role;

------------------------------------------------------------------------ RLS
alter table notify.notification enable row level security;
-- Super admins see their (anchor) tenant's notifications plus the tenant-less rows (system /
-- identity sends). Mirrors n8n.workflow_run's view_runs_super_admin — both policy branches.
CREATE POLICY view_notifications_super_admin ON notify.notification
  FOR SELECT
  USING (
    jwt.has_permission('p:app-admin-super', tenant_id)
    OR (tenant_id IS NULL AND jwt.has_permission('p:app-admin-super'))
  );
-- no insert/update/delete policies: writes happen only inside notify_fn (SECURITY DEFINER)
-- over the n8n_worker connection.

------------------------------------------------------------------------ n8n_worker grants
-- The send-notification + notification-webhook workflows' Postgres nodes connect as n8n_worker
-- (created in fnb-n8n) and call exactly the notify_fn writer surface — never PostGraphile, never
-- authenticator/authenticated. This grant lives HERE, not in fnb-n8n: fnb-notify deploys after
-- fnb-n8n (the n8n_worker role already exists — see the sqitch cross-project dep on
-- fnb-n8n:00000000011230_n8n_policies).
grant usage on schema notify to n8n_worker;
grant usage on schema notify_fn to n8n_worker;
grant execute on all functions in schema notify_fn to n8n_worker;
alter default privileges for role postgres in schema notify_fn grant execute on functions to n8n_worker;
