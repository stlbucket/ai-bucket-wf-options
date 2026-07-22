-- fnb-app RLS (part 3): license + support_ticket — the tables behind the tenant_subscription →
-- license_pack / license_type / application seed chain (self-seeded here so the test owns its data).
-- license: own-profile OR tenant-admin (+ super). support_ticket: own-resident OR tenant-admin OR
-- support staff. Spec: .claude/specs/db-testing/rls-tests.md. Completes the 14-table app coverage.
\set t_a     '11111111-1111-1111-1111-111111111111'
\set t_b     '22222222-2222-2222-2222-222222222222'
\set prof_a1 '33333333-3333-3333-3333-333333333333'
\set prof_a2 '44444444-4444-4444-4444-444444444444'
\set res_a1  'a0000000-0000-0000-0000-0000000000a1'
\set res_a2  'a0000000-0000-0000-0000-0000000000a2'
\set sub_a   'c0000000-0000-0000-0000-0000000000c1'
\set sub_b   'c0000000-0000-0000-0000-0000000000c2'
\set lic_a1  'd0000000-0000-0000-0000-0000000000d1'
\set tik_a1  'e0000000-0000-0000-0000-0000000000e1'

begin;
set search_path to tap, public;
select plan(10);

-- seed chain (as owner): tenant → profile → resident → application/type/pack → subscription → license/ticket
select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_tenant(:'t_b'::uuid, 'tenant-b');
insert into app.profile (id, email) values
  (:'prof_a1'::uuid, 'a1@test.local'), (:'prof_a2'::uuid, 'a2@test.local');
insert into app.resident (id, profile_id, tenant_id, tenant_name, email, display_name, type, status) values
  (:'res_a1'::uuid, :'prof_a1'::uuid, :'t_a'::uuid, 'tenant-a', 'a1@test.local', 'Res A1', 'home', 'active'),
  (:'res_a2'::uuid, :'prof_a2'::uuid, :'t_a'::uuid, 'tenant-a', 'a2@test.local', 'Res A2', 'home', 'active');
insert into app.application (key, name) values ('test-app', 'Test App');
insert into app.license_type (key, application_key, display_name, assignment_scope)
  values ('test-lt', 'test-app', 'Test LT', 'user');
insert into app.license_pack (key, display_name, description) values ('test-pack', 'Test Pack', 'desc');
insert into app.tenant_subscription (id, tenant_id, license_pack_key) values
  (:'sub_a'::uuid, :'t_a'::uuid, 'test-pack'),
  (:'sub_b'::uuid, :'t_b'::uuid, 'test-pack');
insert into app.license (id, tenant_id, resident_id, profile_id, tenant_subscription_id, license_type_key)
  values (:'lic_a1'::uuid, :'t_a'::uuid, :'res_a1'::uuid, :'prof_a1'::uuid, :'sub_a'::uuid, 'test-lt');
insert into app.support_ticket (id, tenant_id, tenant_subscription_id, resident_id, title, description)
  values (:'tik_a1'::uuid, :'t_a'::uuid, :'sub_a'::uuid, :'res_a1'::uuid, 'Help', 'please');

-- ── license ──────────────────────────────────────────────────────────────────────────────────
select is((select relrowsecurity from pg_class where oid = 'app.license'::regclass), true,
  'RLS enabled on app.license');
-- (2) the license's own profile sees it (view_own_profile_licenses)
select test._login(:'prof_a1'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a1'::uuid);
select is((select count(*)::int from app.license where id = :'lic_a1'::uuid), 1,
  'license owner sees their own license');
-- (3) a different plain user does not
select test._login(:'prof_a2'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a2'::uuid);
select is_empty(format($$ select 1 from app.license where id = %L $$, :'lic_a1'),
  'a different plain user cannot see the license');
-- (4) a tenant admin sees tenant licenses (view_own_tenant_licenses)
select test._login(:'prof_a2'::uuid, :'t_a'::uuid, array['p:app-admin'], :'res_a2'::uuid);
select is((select count(*)::int from app.license where id = :'lic_a1'::uuid), 1,
  'tenant admin sees tenant licenses');
-- (5) an admin of another tenant does not
select test._login(:'prof_a2'::uuid, :'t_b'::uuid, array['p:app-admin']);
select is_empty(format($$ select 1 from app.license where id = %L $$, :'lic_a1'),
  'a cross-tenant admin cannot see the license');

-- ── support_ticket ───────────────────────────────────────────────────────────────────────────
select is((select relrowsecurity from pg_class where oid = 'app.support_ticket'::regclass), true,
  'RLS enabled on app.support_ticket');
-- (7) the ticket's own resident sees it (view_own_tickets)
select test._login(:'prof_a1'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a1'::uuid);
select is((select count(*)::int from app.support_ticket where id = :'tik_a1'::uuid), 1,
  'ticket owner sees their own ticket');
-- (8) another (non-admin) resident in the same tenant does NOT (no view_all_for_tenant on tickets)
select test._login(:'prof_a2'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a2'::uuid);
select is_empty(format($$ select 1 from app.support_ticket where id = %L $$, :'tik_a1'),
  'a different tenant resident cannot see the ticket');
-- (9) a tenant admin sees it (view_tenant_tickets)
select test._login(:'prof_a2'::uuid, :'t_a'::uuid, array['p:app-admin'], :'res_a2'::uuid);
select is((select count(*)::int from app.support_ticket where id = :'tik_a1'::uuid), 1,
  'tenant admin sees the tenant ticket');
-- (10) support staff sees it (manage_all_support)
select test._login(:'prof_a2'::uuid, :'t_a'::uuid, array['p:app-admin-support'], :'res_a2'::uuid);
select is((select count(*)::int from app.support_ticket where id = :'tik_a1'::uuid), 1,
  'support staff sees the ticket');

select * from finish();
rollback;
