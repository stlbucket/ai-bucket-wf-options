-- Revert fnb-airports:00000000010810_airports_fn from pg

begin;

drop function if exists airports_fn.airport_sync_status();
drop function if exists airports_fn.record_sync_source(citext, text, text, int);
drop function if exists airports_fn.upsert_navaids(jsonb);
drop function if exists airports_fn.upsert_airport_frequencies(jsonb);
drop function if exists airports_fn.upsert_runways(jsonb);
drop function if exists airports_fn.upsert_airports(jsonb);
drop function if exists airports_fn.upsert_regions(jsonb);
drop function if exists airports_fn.upsert_countries(jsonb);
drop function if exists airports_fn.coerce_enum_label(regtype, text);

drop type if exists airports_fn.airport_map_point;
drop type if exists airports_fn.airport_map_point_options;
drop type if exists airports_fn.search_airports_options;
drop type if exists airports_fn.airport_sync_status;
drop type if exists airports_fn.upsert_result;

commit;
