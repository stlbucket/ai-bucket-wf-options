-- jwt.* helpers (db/fnb-auth/deploy/00000000010150_jwt.sql) — the security core every RLS policy
-- and _api gate reads. auth.user is dropped (fnb-app …010280), so fnb-auth's behavioural surface
-- IS these helpers. No seeding: they read the request.jwt.claims GUC that test._login sets.
-- Spec: .claude/specs/db-testing/fn-behaviour-tests.md.
\set t_a  '11111111-1111-1111-1111-111111111111'
\set prof '33333333-3333-3333-3333-333333333333'
\set res  '55555555-5555-5555-5555-555555555555'

begin;
set search_path to tap, public;
select plan(11);

select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:todo', 'p:app-user'], :'res'::uuid);

-- identity accessors
select is(jwt.tenant_id()::uuid,   :'t_a'::uuid,  'jwt.tenant_id() returns the claim tenant');
select is(jwt.profile_id()::uuid,  :'prof'::uuid, 'jwt.profile_id() returns the claim profile');
select is(jwt.resident_id()::uuid, :'res'::uuid,  'jwt.resident_id() returns the claim resident');

-- permission predicates
select is(jwt.has_permission('p:todo'),  true,  'has_permission true for a held key');
select is(jwt.has_permission('p:nope'),  false, 'has_permission false for a missing key');

-- has_all_permissions: true only when EVERY requested key is held (exact match, via `<@`). Fixed
-- under plan 0150__auth__jwt-has-all-permissions-bug.
select is(jwt.has_all_permissions(array['p:todo','p:app-user']::citext[]), true,
  'has_all_permissions true when all held');
select is(jwt.has_all_permissions(array['p:todo','p:missing']::citext[]), false,
  'has_all_permissions false when one is missing');

-- enforce_permission raises vs. lives
select lives_ok($$ select jwt.enforce_permission('p:todo') $$,
  'enforce_permission lives for a held key');
select throws_ok($$ select jwt.enforce_permission('p:missing') $$, 'P0001', null,
  'enforce_permission raises for a missing key');

-- empty claims (logged out) → null identity / false permissions
select test._logout();
select is(jwt.tenant_id()::text, null, 'jwt.tenant_id() is null with empty claims');
select is(jwt.has_permission('p:todo'), false, 'has_permission is false with empty claims');

select * from finish();
rollback;
