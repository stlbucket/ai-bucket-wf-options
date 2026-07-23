-- storage grant-shape LOCKOUT (Phase 3a, plan 0267). REFRAMED from a classic api-permission test:
-- there is NO storage_api surface. Storage's write path is the upload endpoint carve-out (H3) plus an
-- n8n_worker-only storage_fn surface. The scan/derive/tag functions are explicitly revoked from
-- public + authenticated and granted only to n8n_worker (+ service_role), so an ordinary web caller
-- can never invoke them directly. Anchors: db/fnb-storage/deploy/00000000010625_storage_resolve_asset_scan.sql:38-39,151-154
-- and …010640_storage_n8n_worker.sql:85-94. (The broad `grant execute on all routines` in
-- …010620_storage_policies.sql:14 predates these functions, so it does not re-open them.)
-- This pins the worker-only write path as a regression detector: loosening any revoke turns a test red.

begin;
set search_path to tap, public;
select plan(6);

-- ── resolve_asset_scan: the scan-result write (pending → clean/infected) ──────────────────────────
-- (1) authenticated is locked out
select function_privs_are(
  'storage_fn', 'resolve_asset_scan', array['uuid','storage.scan_status','text','text'],
  'authenticated', array[]::text[],
  'authenticated has NO privileges on storage_fn.resolve_asset_scan (revoked)');
-- (2) anon is locked out
select function_privs_are(
  'storage_fn', 'resolve_asset_scan', array['uuid','storage.scan_status','text','text'],
  'anon', array[]::text[],
  'anon has NO privileges on storage_fn.resolve_asset_scan');
-- (3) n8n_worker (the sole scan writer) may EXECUTE
select function_privs_are(
  'storage_fn', 'resolve_asset_scan', array['uuid','storage.scan_status','text','text'],
  'n8n_worker', array['EXECUTE'],
  'n8n_worker may EXECUTE storage_fn.resolve_asset_scan (the worker write path)');

-- ── asset_for_scan: the worker reads the next quarantined asset ───────────────────────────────────
-- (4) authenticated is locked out
select function_privs_are(
  'storage_fn', 'asset_for_scan', array['uuid'],
  'authenticated', array[]::text[],
  'authenticated has NO privileges on storage_fn.asset_for_scan (revoked)');
-- (5) n8n_worker may EXECUTE
select function_privs_are(
  'storage_fn', 'asset_for_scan', array['uuid'],
  'n8n_worker', array['EXECUTE'],
  'n8n_worker may EXECUTE storage_fn.asset_for_scan');

-- ── insert_derived_asset: the worker writes a scan-derived asset (e.g. a thumbnail) ────────────────
-- (6) authenticated is locked out of the derived-asset write too
select function_privs_are(
  'storage_fn', 'insert_derived_asset', array['uuid','uuid','text','text','text','bigint','text','citext[]'],
  'authenticated', array[]::text[],
  'authenticated has NO privileges on storage_fn.insert_derived_asset (revoked)');

select * from finish();
rollback;
