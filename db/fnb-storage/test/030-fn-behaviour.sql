-- storage_fn behaviour (Phase 3b, plan 0267; db/fnb-storage/deploy/00000000010625_storage_resolve_asset_scan.sql).
-- The n8n_worker/service_role scan surface. All SECURITY DEFINER — run as the owner (no login; the
-- functions are revoked from authenticated, so a logged-in caller cannot reach them — see 020). Seeds
-- a tenant + registered resident (for the resident_urn FK) and a pending asset, all as owner (RLS
-- bypassed). id→res.resource(id) is a DEFERRED FK, so no asset registration is needed under ROLLBACK.
\set t_a   '11111111-1111-1111-1111-111111111111'
\set res_a '55555555-5555-5555-5555-555555555555'
\set a_id  '77777777-7777-7777-7777-777777777777'
\set b_id  '88888888-8888-8888-8888-888888888888'
\set c_id  '99999999-9999-9999-9999-999999999999'

begin;
set search_path to tap, public;
select plan(12);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_resident(:'res_a'::uuid, :'t_a'::uuid);
select res_fn.build_urn(:'t_a'::uuid, 'app', 'resident', :'res_a'::uuid) as res_urn \gset

insert into storage.asset (id, tenant_id, resident_urn, is_public, original_name, extension,
  content_type, size_bytes, bucket, storage_key, checksum_sha256)
values
  (:'a_id'::uuid, :'t_a'::uuid, :'res_urn', false, 'photo.jpg', 'jpg', 'image/jpeg', 1234,
   'assets', 'quarantine/photo.jpg', 'sha-a'),
  (:'b_id'::uuid, :'t_a'::uuid, :'res_urn', false, 'virus.exe', 'exe', 'application/octet-stream',
   4096, 'assets', 'quarantine/virus.exe', 'sha-b');

-- ── resolve_asset_scan: clean verdict promotes + rewrites storage_key ──────────────────────────────
select storage_fn.resolve_asset_scan(:'a_id'::uuid, 'clean'::storage.scan_status, null, 'final/photo.jpg');
select is(
  (select scan_status::text from storage.asset where id = :'a_id'::uuid), 'clean',
  'resolve_asset_scan(clean) sets scan_status clean');
select is(
  (select storage_key from storage.asset where id = :'a_id'::uuid), 'final/photo.jpg',
  'resolve_asset_scan promotes storage_key to the final key');

-- ── idempotency: a re-run on an already-resolved asset is a no-op (guards on scan_status='pending') ─
select storage_fn.resolve_asset_scan(:'a_id'::uuid, 'infected'::storage.scan_status, 'Win.Test', null);
select is(
  (select scan_status::text from storage.asset where id = :'a_id'::uuid), 'clean',
  'resolve_asset_scan is idempotent — a re-run leaves the resolved verdict unchanged');

-- ── infected verdict cascades asset_status → deleted ──────────────────────────────────────────────
select storage_fn.resolve_asset_scan(:'b_id'::uuid, 'infected'::storage.scan_status, 'Win.Trojan.X', null);
select is(
  (select scan_status::text from storage.asset where id = :'b_id'::uuid), 'infected',
  'resolve_asset_scan(infected) sets scan_status infected');
select is(
  (select asset_status::text from storage.asset where id = :'b_id'::uuid), 'deleted',
  'infected verdict cascades asset_status to deleted');

-- ── guard: unknown asset id raises ─────────────────────────────────────────────────────────────────
select throws_ok(
  $$ select storage_fn.resolve_asset_scan(gen_random_uuid(), 'clean'::storage.scan_status, null, null) $$,
  'P0001', null,
  'resolve_asset_scan raises for an unknown asset id');

-- ── insert_derived_asset: born clean, parent-linked, inherits tenant ───────────────────────────────
select storage_fn.insert_derived_asset(
  :'a_id'::uuid, :'c_id'::uuid, 'final/thumb.jpg', 'jpg', 'image/jpeg', 500, 'sha-c',
  array['thumbnail']::citext[]);
select is(
  (select scan_status::text from storage.asset where id = :'c_id'::uuid), 'clean',
  'insert_derived_asset child is born clean');
select is(
  (select parent_asset_id from storage.asset where id = :'c_id'::uuid), :'a_id'::uuid,
  'derived asset links to its parent');
select is(
  (select tenant_id from storage.asset where id = :'c_id'::uuid), :'t_a'::uuid,
  'derived asset inherits the parent tenant');

-- ── insert_derived_asset idempotency: a second call returns the existing thumbnail (no duplicate) ──
select storage_fn.insert_derived_asset(
  :'a_id'::uuid, gen_random_uuid(), 'final/thumb2.jpg', 'jpg', 'image/jpeg', 500, 'sha-c2',
  array['thumbnail']::citext[]);
select is(
  (select count(*)::int from storage.asset where parent_asset_id = :'a_id'::uuid
     and 'thumbnail' = any(tags)), 1,
  'insert_derived_asset is idempotent — no duplicate thumbnail child');

-- ── add_asset_tags: set-union append, no duplicates ───────────────────────────────────────────────
select storage_fn.add_asset_tags(:'a_id'::uuid, array['ai-tag']::citext[]);
select storage_fn.add_asset_tags(:'a_id'::uuid, array['ai-tag']::citext[]);
select is(
  (select count(*)::int from unnest((select tags from storage.asset where id = :'a_id'::uuid)) t
     where t = 'ai-tag'::citext), 1,
  'add_asset_tags set-unions — a repeated tag is not duplicated');
select throws_ok(
  $$ select storage_fn.add_asset_tags(gen_random_uuid(), array['x']::citext[]) $$,
  'P0001', null,
  'add_asset_tags raises for an unknown asset id');

select * from finish();
rollback;
