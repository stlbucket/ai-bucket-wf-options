-- storage.asset RLS: manage_all_for_tenant (FOR ALL, jwt.has_permission('p:app-user'|'p:app-admin',
-- tenant_id)) + manage_all_super_admin (p:app-admin-super). anon is DELIBERATELY not granted SELECT
-- (grant-level lockout, distinct from RLS). resident_urn is NOT NULL → seed a registered resident.
-- Spec: .claude/specs/db-testing/rls-tests.md.
\set t_a    '11111111-1111-1111-1111-111111111111'
\set t_b    '22222222-2222-2222-2222-222222222222'
\set res_a  '55555555-5555-5555-5555-555555555555'
\set res_b  '66666666-6666-6666-6666-666666666666'
\set as_a   'a0000000-0000-0000-0000-00000000a5a1'
\set as_b   'b0000000-0000-0000-0000-00000000b5b2'
\set prof   '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(6);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_tenant(:'t_b'::uuid, 'tenant-b');
select test._seed_resident(:'res_a'::uuid, :'t_a'::uuid);
select test._seed_resident(:'res_b'::uuid, :'t_b'::uuid);
insert into storage.asset
  (id, tenant_id, resident_urn, is_public, original_name, extension, content_type,
   size_bytes, bucket, storage_key, checksum_sha256)
values
  (:'as_a'::uuid, :'t_a'::uuid, res_fn.build_urn(:'t_a'::uuid, 'app', 'resident', :'res_a'::uuid),
   false, 'a.png', 'png', 'image/png', 10, 'assets', 'a/a.png', 'aa'),
  (:'as_b'::uuid, :'t_b'::uuid, res_fn.build_urn(:'t_b'::uuid, 'app', 'resident', :'res_b'::uuid),
   false, 'b.png', 'png', 'image/png', 10, 'assets', 'b/b.png', 'bb');

-- (1) RLS enabled
select is(
  (select relrowsecurity from pg_class where oid = 'storage.asset'::regclass),
  true, 'RLS enabled on storage.asset');

-- (2) tenant A user with p:app-user sees its own asset
select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a'::uuid);
select set_eq(
  format($$ select original_name from storage.asset where id in (%L, %L) $$, :'as_a', :'as_b'),
  array['a.png'], 'tenant A + p:app-user sees only its own asset');

-- (3) tenant A user with NO app permission sees nothing (policy needs p:app-user OR p:app-admin)
select test._login(:'prof'::uuid, :'t_a'::uuid, array[]::text[], :'res_a'::uuid);
select is_empty(
  format($$ select 1 from storage.asset where id in (%L, %L) $$, :'as_a', :'as_b'),
  'user without p:app-user/p:app-admin sees no assets');

-- (4) tenant B user does not see tenant A's asset
select test._login(:'prof'::uuid, :'t_b'::uuid, array['p:app-user'], :'res_b'::uuid);
select set_eq(
  format($$ select original_name from storage.asset where id in (%L, %L) $$, :'as_a', :'as_b'),
  array['b.png'], 'tenant B sees only its own asset');

-- (5) super-admin sees both (cross-tenant)
select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:app-admin-super']);
select is(
  (select count(*)::int from storage.asset where id in (:'as_a'::uuid, :'as_b'::uuid)),
  2, 'super-admin sees assets across tenants');

-- (6) anon cannot even SELECT the table (no SELECT grant — grant-level, not RLS)
select test._logout();
set local role anon;
select throws_ok('select 1 from storage.asset', '42501', null,
  'anon is denied SELECT on storage.asset at the grant level');

select * from finish();
rollback;
