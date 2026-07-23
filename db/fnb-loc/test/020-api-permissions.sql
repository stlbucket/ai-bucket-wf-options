-- loc_api permission posture (Phase 3a, plan 0267). Ground truth (db/fnb-loc/deploy/…010310_loc_fn.sql,
-- …010330_loc_policies.sql): loc_api.create/update/delete_location have NO jwt permission gate — they
-- are SECURITY INVOKER and delegate straight to loc_fn. Isolation is RLS ONLY: loc.location has a single
-- policy `manage_all_for_tenant FOR ALL USING/WITH CHECK (jwt.tenant_id() = tenant_id)` (no p:loc
-- predicate). This suite DOCUMENTS that reality (D8) so a future api-layer hardening has failing tests
-- to flip. Flip the lives_ok/GAP assertions to throws_ok when a p:loc gate is added.
\set t_a    '11111111-1111-1111-1111-111111111111'
\set t_b    '22222222-2222-2222-2222-222222222222'
\set res_a  '55555555-5555-5555-5555-555555555555'
\set prof_a '33333333-3333-3333-3333-333333333333'
\set prof_b '44444444-4444-4444-4444-444444444444'

begin;
set search_path to tap, public;
select plan(6);

-- ── owner-phase seeds + a tenant-A location whose id we capture for the cross-tenant delete test ──
select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_resident(:'res_a'::uuid, :'t_a'::uuid);
select loc_fn.create_location(
  row(null::uuid, 'A place'::text, null, null, null, null, null, null, null, null)::loc_fn.location_info,
  :'res_a'::uuid);
select id as loc_a_id from loc.location where name = 'A place' \gset

-- (1) grant shape (reality pin): authenticated may EXECUTE the api fn — the grant is NOT the boundary.
select function_privs_are(
  'loc_api', 'create_location', array['loc_fn.location_info'],
  'authenticated', array['EXECUTE'],
  'authenticated may EXECUTE loc_api.create_location');

-- (2) GAP: loc_fn is broadly granted too — anon can EXECUTE it directly (organizational split only).
select function_privs_are(
  'loc_fn', 'create_location', array['loc_fn.location_info','uuid'],
  'anon', array['EXECUTE'],
  'GAP: anon can EXECUTE loc_fn.create_location directly (broad grant, not a privilege boundary)');

-- (3) GAP: update_location exists but is ungated (no p:loc required; only a null-id guard in loc_fn).
select has_function(
  'loc_api', 'update_location', array['loc_fn.location_info'],
  'loc_api.update_location exists (NOTE: currently ungated — no p:loc required)');

-- (4) GAP: create_location is ungated — a caller with EMPTY permissions (but a valid own-tenant
--     resident claim) still creates a location. Only RLS tenant-match + resident existence apply.
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array[]::text[], :'res_a'::uuid);
select lives_ok(
  $$ select loc_api.create_location(
       row(null::uuid, 'my place'::text, null, null, null, null, null, null, null, null)::loc_fn.location_info) $$,
  'GAP: create_location succeeds with no permissions (ungated; RLS tenant-match is the only barrier)');

-- (5) delete_location is ungated AND returns true even for another tenant's location: as tenant B the
--     RLS DELETE (USING jwt.tenant_id()=tenant_id) matches 0 rows, but the fn returns true regardless.
--     (Deeper GAP, noted not asserted: loc_fn.delete_location also calls res_fn.archive_resource on the
--     id unconditionally, so a cross-tenant delete can archive the registry row even as the loc survives.)
select test._login(:'prof_b'::uuid, :'t_b'::uuid, array[]::text[]);
select is(
  loc_api.delete_location(:'loc_a_id'::uuid), true,
  'GAP: delete_location returns true for another tenant''s location (ungated; RLS scopes the delete)');

-- (6) the tenant-A location SURVIVED the cross-tenant delete (RLS made it a no-op). Probed as owner.
select test._logout();
select is(
  (select count(*)::int from loc.location where id = :'loc_a_id'::uuid), 1,
  'the location survived the cross-tenant delete (RLS made the DELETE a no-op)');

select * from finish();
rollback;
