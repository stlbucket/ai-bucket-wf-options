-- Verify fnb-location-datasets:00000000010715_location_datasets_api on pg

begin;

select has_function_privilege('location_datasets_api.search_breweries(location_datasets_fn.search_breweries_options)', 'execute');
select has_function_privilege('location_datasets_api.brewery_map_points()', 'execute');
select has_function_privilege('location_datasets_api.brewery_sync_status()', 'execute');

rollback;
