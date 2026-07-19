-- Verify fnb-location-datasets:00000000010710_location_datasets_fn on pg

begin;

select has_function_privilege('location_datasets_fn.upsert_breweries(jsonb)', 'execute');
select has_function_privilege('location_datasets_fn.brewery_sync_status()', 'execute');

-- integer division: anything less than all four types present divides by zero
select 1/(count(*)/4) from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'location_datasets_fn'
    and t.typname in ('upsert_result', 'brewery_sync_status', 'search_breweries_options', 'brewery_map_point');

rollback;
