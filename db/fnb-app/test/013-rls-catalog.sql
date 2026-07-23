-- fnb-app RLS (part 4, plan 0267): the reference-catalog tables. application, license_pack,
-- license_pack_license_type, license_type, license_type_permission each have RLS enabled with a
-- single permissive SELECT policy (view_all_users USING (1=1)) and NO write policy — writes happen
-- via seed/install only. (app.permission, the sixth such catalog, is already covered in 010-rls.sql.)
-- Structural assertions + one visibility probe proving the catalog is not tenant/permission-gated.
\set prof '33333333-3333-3333-3333-333333333333'
\set t_a  '11111111-1111-1111-1111-111111111111'

begin;
set search_path to tap, public;
select plan(4);

-- (1) RLS enabled on all five catalog tables
select is(
  (select bool_and(c.relrowsecurity) from pg_class c
     where c.oid = any(array['app.application','app.license_pack','app.license_pack_license_type',
                             'app.license_type','app.license_type_permission']::regclass[])),
  true, 'RLS enabled on all five app reference-catalog tables');

-- (2) none of them has a write policy (SELECT-only → INSERT/UPDATE/DELETE denied to request roles)
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'app' and cmd <> 'SELECT'
      and tablename in ('application','license_pack','license_pack_license_type',
                        'license_type','license_type_permission')),
  0, 'reference-catalog tables have no write policies');

-- (3) each of the five has exactly its permissive SELECT policy
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'app' and cmd = 'SELECT'
      and tablename in ('application','license_pack','license_pack_license_type',
                        'license_type','license_type_permission')),
  5, 'each reference-catalog table has a permissive SELECT policy');

-- (4) visibility: an owner-seeded catalog row is visible to a permissionless user in any tenant
--     (view_all_users USING (1=1) is neither tenant- nor permission-gated).
insert into app.application (key, name) values ('pgtap-cat-app-0267', 'PgTAP Catalog App');
select test._login(:'prof'::uuid, :'t_a'::uuid, array[]::text[]);
select is(
  (select count(*)::int from app.application where key = 'pgtap-cat-app-0267'), 1,
  'a permissionless user sees a reference-catalog row (USING 1=1, not tenant/permission-gated)');

select * from finish();
rollback;
