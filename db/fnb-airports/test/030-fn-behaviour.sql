-- airports_fn.upsert_countries behaviour (Phase 3b, plan 0267;
-- db/fnb-airports/deploy/00000000010810_airports_fn.sql). The sync-airports n8n workflow's per-page
-- write fn (SECURITY DEFINER, n8n_worker-granted — run here as owner). Countries are the FK-free root
-- of the OurAirports graph, so this is the cleanest idempotency probe. Rows keyed by a unique
-- external_id, rolled back. Covers: insert/update accounting, continent enum coercion, idempotency.
\set ext '99990267'

begin;
set search_path to tap, public;
select plan(7);

-- ── first upsert: one new country. 'zz-not-a-continent' is not a valid continent → coerced 'unknown'.
select r.inserted as ins1, r.updated as upd1
from airports_fn.upsert_countries(
  ('[{"id":"' || :'ext' || '","code":"ZZ","name":"PgTAP Land","continent":"zz-not-a-continent"}]')::jsonb
) r \gset

select is(:'ins1'::int, 1, 'first upsert inserts the new country (inserted = 1)');
select is(:'upd1'::int, 0, 'first upsert updates nothing (updated = 0)');
select is(
  (select continent::text from airports.country where external_id = :'ext'::int), 'unknown',
  'an unrecognized upstream continent is coerced to unknown');
select ok(
  (select notes from airports.country where external_id = :'ext'::int)
    like '%upstream continent: zz-not-a-continent%',
  'the raw upstream continent is preserved in notes');

-- ── second upsert of the SAME external_id: an update, not a duplicate insert ───────────────────────
select r.inserted as ins2, r.updated as upd2
from airports_fn.upsert_countries(
  ('[{"id":"' || :'ext' || '","code":"ZZ","name":"PgTAP Land (renamed)","continent":"zz-not-a-continent"}]')::jsonb
) r \gset

select is(:'ins2'::int, 0, 'second upsert inserts nothing (idempotent — inserted = 0)');
select is(:'upd2'::int, 1, 'second upsert updates the existing row (updated = 1)');
select is(
  (select count(*)::int from airports.country where external_id = :'ext'::int), 1,
  'idempotent: the external_id maps to exactly one country row after two upserts');

select * from finish();
rollback;
