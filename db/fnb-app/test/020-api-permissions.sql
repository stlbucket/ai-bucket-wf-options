-- app_api permission gates (Phase 3a, plan 0267). The 16-table security core delegates through a
-- thin app_api layer whose ENFORCEMENT LIVES IN app_fn — so we assert the observable gate at the
-- app_api boundary (what PostGraphile exposes), regardless of which layer raises. Verified anchors:
--   * become_support        — super OR support   (db/fnb-app/deploy/…010243_app_fn_support.sql:11-17)
--   * update_tenant_status   — p:app-admin-super  (…010240_app_fn.sql:1664)
--   * set_nested_tenant_type — p:app-admin        (…010240_app_fn.sql:1555)
-- The stack's `raise exception '30000: …'` / jwt.enforce_permission both surface as SQLSTATE P0001.
--
-- KNOWN GAP this suite documents (asserted as CURRENT reality): app_api routines are broadly granted
-- (`grant all on all routines in schema app_api to anon, authenticated, service_role` —
-- …010250_app_policies.sql:4). The grant is NOT the privilege boundary — the jwt permission gate is.
\set t_a    '11111111-1111-1111-1111-111111111111'
\set prof_a '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(6);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');

-- (1) super-OR-support gate: a caller with neither p:app-admin-super nor p:app-admin-support is
--     rejected. The check is become_support's first statement — no support-mode side effects run.
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-user']);
select throws_ok(
  $$ select app_api.become_support('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'P0001', null,
  'become_support without super/support raises PERMISSION DENIED');

-- (2) super gate, negative: update_tenant_status requires p:app-admin-super.
-- NOTE: psql does NOT interpolate :'t_a' inside $$…$$ dollar-quoted strings — the tenant uuid is
-- written as a literal inside these payloads (matching t_a above), while :'t_a' is fine outside them.
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-user']);
select throws_ok(
  $$ select app_api.update_tenant_status('11111111-1111-1111-1111-111111111111'::uuid, 'inactive'::app.tenant_status) $$,
  'P0001', null,
  'update_tenant_status without p:app-admin-super raises');

-- (3) super gate, positive: WITH p:app-admin-super the gate opens AND the RLS manage_tenant policy
--     (FOR ALL USING p:app-admin-super — …010250_app_policies.sql:76) admits the UPDATE.
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-admin-super']);
select lives_ok(
  $$ select app_api.update_tenant_status('11111111-1111-1111-1111-111111111111'::uuid, 'active'::app.tenant_status) $$,
  'update_tenant_status with p:app-admin-super succeeds');

-- (4) admin gate, negative: set_nested_tenant_type requires p:app-admin.
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-user']);
select throws_ok(
  $$ select app_api.set_nested_tenant_type('11111111-1111-1111-1111-111111111111'::uuid, 'workspace'::app.tenant_type) $$,
  'P0001', null,
  'set_nested_tenant_type without p:app-admin raises');

-- (5) grant shape (reality pin): authenticated may EXECUTE the api fn (gate, not grant, is the boundary)
select function_privs_are(
  'app_api', 'become_support', array['uuid'],
  'authenticated', array['EXECUTE'],
  'authenticated may EXECUTE app_api.become_support');

-- (6) grant shape: authenticated may EXECUTE app_api.update_tenant_status
select function_privs_are(
  'app_api', 'update_tenant_status', array['uuid','app.tenant_status'],
  'authenticated', array['EXECUTE'],
  'authenticated may EXECUTE app_api.update_tenant_status');

select * from finish();
rollback;
