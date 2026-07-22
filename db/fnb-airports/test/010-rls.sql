-- Public read-only catalog: every airports.* table has RLS enabled with a single permissive
-- SELECT policy (view_all USING true) and NO write policy — writes happen only inside airports_fn.*
-- (SECURITY DEFINER) from the sync worker. Spec: .claude/specs/db-testing/rls-tests.md.
-- Structural assertions (pg_class/pg_policies) — no seeding needed for a public catalog.
begin;
set search_path to tap, public;
select plan(5);

-- (1) RLS enabled on every base table in the schema
select is(
  (select bool_and(c.relrowsecurity)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'airports' and c.relkind = 'r'),
  true, 'RLS enabled on all airports.* tables');

-- (2) exactly the 7 known tables carry RLS
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'airports' and c.relkind = 'r' and c.relrowsecurity),
  7, 'all 7 airports tables have RLS');

-- (3) every policy is SELECT-only (no INSERT/UPDATE/DELETE policy → writes denied to request roles)
select is(
  (select count(*)::int from pg_policies where schemaname = 'airports' and cmd <> 'SELECT'),
  0, 'airports tables have no write policies (worker-only writes)');

-- (4) each RLS table has its permissive view_all SELECT policy
select is(
  (select count(*)::int from pg_policies where schemaname = 'airports' and cmd = 'SELECT'),
  7, 'each airports table has a permissive SELECT policy');

-- (5) anon can actually read the catalog (view_all USING true + anon SELECT grant)
select test._logout();
set local role anon;
select lives_ok('select 1 from airports.airport limit 1', 'anon can read airports.airport');

select * from finish();
rollback;
