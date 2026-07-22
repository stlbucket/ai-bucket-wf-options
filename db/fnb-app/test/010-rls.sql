-- fnb-app RLS smoke (subset — app has 14 RLS tables; this covers the core shapes). profile:
-- view_self / manage_all_super_admin. reference catalogs (permission, …): view_all_users. tenant:
-- own-tenant visibility. Spec: .claude/specs/db-testing/rls-tests.md. Fuller app coverage (resident
-- multi-policy, licenses, support tickets, auth.session deny-all) is future work per the README.
\set t_a    '11111111-1111-1111-1111-111111111111'
\set prof_a '33333333-3333-3333-3333-333333333333'
\set prof_b '44444444-4444-4444-4444-444444444444'

begin;
set search_path to tap, public;
select plan(5);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
insert into app.profile (id, email) values
  (:'prof_a'::uuid, 'a@test.local'),
  (:'prof_b'::uuid, 'b@test.local');

-- (1) RLS enabled on app.profile
select is(
  (select relrowsecurity from pg_class where oid = 'app.profile'::regclass),
  true, 'RLS enabled on app.profile');

-- (2) view_self: a user sees only their own profile
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-user']);
select set_eq(
  format($$ select email::text from app.profile where id in (%L, %L) $$, :'prof_a', :'prof_b'),
  array['a@test.local'],
  'a user sees only their own profile (view_self)');

-- (3) super-admin sees all profiles
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-admin-super']);
select is(
  (select count(*)::int from app.profile where id in (:'prof_a'::uuid, :'prof_b'::uuid)),
  2, 'super-admin sees all profiles (manage_all_super_admin)');

-- (4) reference catalog (app.permission) is visible to any authenticated user (view_all_users)
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-user']);
select ok((select count(*) from app.permission) > 0,
  'authenticated user can read the permission catalog');

-- (5) a user sees their own tenant
select is(
  (select count(*)::int from app.tenant where id = :'t_a'::uuid), 1,
  'a user sees their own tenant');

select * from finish();
rollback;
