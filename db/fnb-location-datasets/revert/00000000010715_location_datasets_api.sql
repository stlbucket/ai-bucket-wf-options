-- Revert fnb-location-datasets:00000000010715_location_datasets_api from pg

begin;

drop function if exists location_datasets_api.brewery_sync_status();
drop function if exists location_datasets_api.brewery_map_points();
drop function if exists location_datasets_api.search_breweries(location_datasets_fn.search_breweries_options);

commit;
