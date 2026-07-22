-- loc.location RLS: tenant-scoped manage (manage_all_for_tenant, FOR ALL, jwt.tenant_id() =
-- tenant_id) PLUS a public overlay (view_public, FOR SELECT, is_public = true). resident_urn is
-- nullable (010340), so no resident seeding is needed here. Spec: .claude/specs/db-testing/rls-tests.md.
\set t_a    '11111111-1111-1111-1111-111111111111'
\set t_b    '22222222-2222-2222-2222-222222222222'
\set l_a    'aa000000-0000-0000-0000-000000000001'
\set l_b    'bb000000-0000-0000-0000-000000000002'
\set l_pub  'cc000000-0000-0000-0000-000000000003'
\set prof_a '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(5);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_tenant(:'t_b'::uuid, 'tenant-b');
insert into loc.location (id, tenant_id, name, is_public) values
  (:'l_a'::uuid,   :'t_a'::uuid, 'loc-a',   false),
  (:'l_b'::uuid,   :'t_b'::uuid, 'loc-b',   false),
  (:'l_pub'::uuid, :'t_b'::uuid, 'loc-pub', true);

-- (1) RLS enabled
select is(
  (select relrowsecurity from pg_class where oid = 'loc.location'::regclass),
  true, 'RLS enabled on loc.location');

-- (2) tenant A sees its own rows + any public row (its own private + tenant B's public)
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-user']);
select set_eq(
  'select name from loc.location',
  array['loc-a', 'loc-pub'],
  'tenant A sees own rows + public rows (not tenant B private)');

-- (3) tenant A cannot see tenant B private rows
select is_empty(
  $$ select 1 from loc.location where tenant_id <> jwt.tenant_id()::uuid and is_public = false $$,
  'tenant A cannot see tenant B private rows');

-- (4) anon sees only public rows
select test._logout();
set local role anon;
select set_eq('select name from loc.location', array['loc-pub'], 'anon sees only public locations');

-- (5) cross-tenant write denied by manage_all_for_tenant WITH CHECK
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-user']);
select throws_ok(
  format($$ insert into loc.location (id, tenant_id, name) values (gen_random_uuid(), %L, 'sneaky') $$, :'t_b'),
  '42501', null, 'tenant A cannot insert a tenant B location');

select * from finish();
rollback;
