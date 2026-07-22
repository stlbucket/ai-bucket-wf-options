-- fnb-app RLS (part 2): resident visibility/mutation + auth.session deny-all. resident's dominant
-- SELECT policy is view_all_for_tenant (any tenant member sees all its residents); UPDATE requires
-- own-profile (update_own_resident) or tenant-admin (manage_own_tenant_residencies).
-- Spec: .claude/specs/db-testing/rls-tests.md. (license/support_ticket need the tenant_subscription
-- chain — future work per the README.)
\set t_a     '11111111-1111-1111-1111-111111111111'
\set t_b     '22222222-2222-2222-2222-222222222222'
\set prof_a1 '33333333-3333-3333-3333-333333333333'
\set prof_a2 '44444444-4444-4444-4444-444444444444'
\set res_a1  'a0000000-0000-0000-0000-0000000000a1'
\set res_a2  'a0000000-0000-0000-0000-0000000000a2'
\set res_b1  'b0000000-0000-0000-0000-0000000000b1'

begin;
set search_path to tap, public;
select plan(5);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_tenant(:'t_b'::uuid, 'tenant-b');
insert into app.profile (id, email) values
  (:'prof_a1'::uuid, 'a1@test.local'), (:'prof_a2'::uuid, 'a2@test.local');
insert into app.resident (id, profile_id, tenant_id, tenant_name, email, display_name, type, status) values
  (:'res_a1'::uuid, :'prof_a1'::uuid, :'t_a'::uuid, 'tenant-a', 'a1@test.local', 'Res A1',   'home', 'active'),
  (:'res_a2'::uuid, :'prof_a2'::uuid, :'t_a'::uuid, 'tenant-a', 'a2@test.local', 'orig-a2',  'home', 'active'),
  (:'res_b1'::uuid, null,             :'t_b'::uuid, 'tenant-b', 'b1@test.local', 'Res B1',   'home', 'active');

-- (1) RLS enabled
select is(
  (select relrowsecurity from pg_class where oid = 'app.resident'::regclass),
  true, 'RLS enabled on app.resident');

-- (2) any tenant member sees all its residents, not another tenant's (view_all_for_tenant)
select test._login(:'prof_a1'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a1'::uuid);
select set_eq(
  format($$ select email::text from app.resident where id in (%L, %L, %L) $$,
         :'res_a1', :'res_a2', :'res_b1'),
  array['a1@test.local', 'a2@test.local'],
  'tenant A user sees both tenant-A residents, not tenant B');

-- (3) a plain user cannot UPDATE another resident (no applicable UPDATE policy → no-op)
update app.resident set display_name = 'hacked' where id = :'res_a2'::uuid;   -- as p:app-user
select test._logout();
select is((select display_name::text from app.resident where id = :'res_a2'::uuid), 'orig-a2',
  'plain user cannot update another tenant resident');

-- (4) a tenant admin CAN update a tenant resident (manage_own_tenant_residencies)
select test._login(:'prof_a1'::uuid, :'t_a'::uuid, array['p:app-admin'], :'res_a1'::uuid);
update app.resident set display_name = 'admin-set' where id = :'res_a2'::uuid;
select test._logout();
select is((select display_name::text from app.resident where id = :'res_a2'::uuid), 'admin-set',
  'tenant admin can update a tenant resident');

-- (5) auth.session is deny-all: authenticated cannot SELECT it (grant revoked)
select test._login(:'prof_a1'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a1'::uuid);
select throws_ok('select 1 from auth.session', '42501', null,
  'authenticated is denied SELECT on auth.session');

select * from finish();
rollback;
