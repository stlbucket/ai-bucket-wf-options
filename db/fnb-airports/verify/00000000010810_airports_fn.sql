-- Verify fnb-airports:00000000010810_airports_fn on pg

begin;

select has_function_privilege('airports_fn.coerce_enum_label(regtype, text)', 'execute');
select has_function_privilege('airports_fn.upsert_countries(jsonb)', 'execute');
select has_function_privilege('airports_fn.upsert_regions(jsonb)', 'execute');
select has_function_privilege('airports_fn.upsert_airports(jsonb)', 'execute');
select has_function_privilege('airports_fn.upsert_runways(jsonb)', 'execute');
select has_function_privilege('airports_fn.upsert_airport_frequencies(jsonb)', 'execute');
select has_function_privilege('airports_fn.upsert_navaids(jsonb)', 'execute');
select has_function_privilege('airports_fn.record_sync_source(citext, text, text, int)', 'execute');
select has_function_privilege('airports_fn.airport_sync_status()', 'execute');

-- integer division: fewer than all five types present divides by zero
select 1/(count(*)/5) from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'airports_fn'
    and t.typname in ('upsert_result', 'airport_sync_status', 'search_airports_options',
                      'airport_map_point_options', 'airport_map_point');

rollback;
