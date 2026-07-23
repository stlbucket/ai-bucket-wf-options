-- location_datasets_fn.upsert_breweries behaviour (Phase 3b, plan 0267;
-- db/fnb-location-datasets/deploy/00000000010710_location_datasets_fn.sql). The sync-breweries n8n
-- workflow's per-page write fn (SECURITY DEFINER, n8n_worker-granted — run here as owner). Reads the
-- real anchor tenant (present in the seeded dev DB); all rows are keyed by a unique external_id and
-- roll back. Covers: insert-vs-update accounting, upstream enum coercion → 'unknown', and idempotency.
\set ext 'pgtap-brewery-0267'

begin;
set search_path to tap, public;
select plan(7);

-- ── first upsert: one new brewery. 'zzz-not-a-type' is not in the enum vocabulary → 'unknown'. ─────
select r.inserted as ins1, r.updated as upd1
from location_datasets_fn.upsert_breweries(
  ('[{"id":"' || :'ext' || '","name":"PgTAP Test Brewery","brewery_type":"zzz-not-a-type",'
   || '"city":"Testville","state_province":"TS","country":"United States",'
   || '"latitude":"38.6","longitude":"-90.2","website_url":"http://example.test"}]')::jsonb
) r \gset

select is(:'ins1'::int, 1, 'first upsert inserts the new brewery (inserted = 1)');
select is(:'upd1'::int, 0, 'first upsert updates nothing (updated = 0)');
select is(
  (select brewery_type::text from location_datasets.brewery where external_id = :'ext'), 'unknown',
  'an unrecognized upstream brewery_type is coerced to unknown');
select ok(
  (select notes from location_datasets.brewery where external_id = :'ext')
    like '%upstream brewery_type: zzz-not-a-type%',
  'the raw upstream type is preserved in notes');

-- ── second upsert of the SAME external_id: an update, not a duplicate insert ───────────────────────
select r.inserted as ins2, r.updated as upd2
from location_datasets_fn.upsert_breweries(
  ('[{"id":"' || :'ext' || '","name":"PgTAP Test Brewery (renamed)","brewery_type":"micro",'
   || '"country":"United States"}]')::jsonb
) r \gset

select is(:'ins2'::int, 0, 'second upsert inserts nothing (idempotent — inserted = 0)');
select is(:'upd2'::int, 1, 'second upsert updates the existing row (updated = 1)');
select is(
  (select count(*)::int from location_datasets.brewery where external_id = :'ext'), 1,
  'idempotent: the external_id maps to exactly one brewery row after two upserts');

select * from finish();
rollback;
