-- Revert fnb-location-datasets:00000000010710_location_datasets_fn from pg

begin;

drop function if exists location_datasets_fn.brewery_sync_status();
drop function if exists location_datasets_fn.upsert_breweries(jsonb);

drop type if exists location_datasets_fn.brewery_map_point;
drop type if exists location_datasets_fn.search_breweries_options;
drop type if exists location_datasets_fn.brewery_sync_status;
drop type if exists location_datasets_fn.upsert_result;

commit;
