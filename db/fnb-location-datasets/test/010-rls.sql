-- Public read-only dataset: location_datasets.brewery has RLS enabled, one permissive SELECT
-- policy (view_all USING true), and NO write policy — writes only via
-- location_datasets_fn.upsert_breweries (SECURITY DEFINER) from the worker.
-- Spec: .claude/specs/db-testing/rls-tests.md.
begin;
set search_path to tap, public;
select plan(4);

-- (1) RLS enabled
select is(
  (select relrowsecurity from pg_class where oid = 'location_datasets.brewery'::regclass),
  true, 'RLS enabled on location_datasets.brewery');

-- (2) permissive SELECT policy present
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'location_datasets' and tablename = 'brewery' and cmd = 'SELECT'),
  1, 'brewery has a permissive SELECT policy (view_all)');

-- (3) no write policy → request-role writes denied (worker-only via SECURITY DEFINER)
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'location_datasets' and tablename = 'brewery' and cmd <> 'SELECT'),
  0, 'brewery has no write policies');

-- (4) anon can read the public dataset
select test._logout();
set local role anon;
select lives_ok('select 1 from location_datasets.brewery limit 1', 'anon can read breweries');

select * from finish();
rollback;
