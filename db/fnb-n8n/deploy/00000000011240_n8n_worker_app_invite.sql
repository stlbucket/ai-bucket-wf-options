-- Deploy fnb-n8n:00000000011240_n8n_worker_app_invite to pg
-- requires: 00000000011230_n8n_policies
-- requires: fnb-app:00000000010242_app_fn_definers

begin;

-- The invite-user n8n workflow (user-invitation spec, R22) creates the invited resident by calling
-- app_fn.invite_user as the n8n_worker service role (SECURITY DEFINER; idempotent per
-- (email, tenant_id)). This grant lives HERE, not in fnb-app: fnb-app deploys BEFORE fnb-n8n, so
-- the n8n_worker role does not exist yet when fnb-app runs (same lesson as the notify/asset worker
-- grants — the grant goes in the first package that deploys after fnb-n8n and can see both the
-- role and the function). Least-privilege: usage on app_fn + execute on exactly this one function
-- (app_fn's default privileges grant only anon/authenticated/service_role, so nothing else leaks).
grant usage on schema app_fn to n8n_worker;
grant execute on function
  app_fn.invite_user(uuid, citext, app.license_type_assignment_scope)
  to n8n_worker;

commit;
