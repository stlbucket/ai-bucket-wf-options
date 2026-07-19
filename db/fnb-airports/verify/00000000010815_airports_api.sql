-- Verify fnb-airports:00000000010815_airports_api on pg

begin;

select has_function_privilege('airports_api.search_airports(airports_fn.search_airports_options)', 'execute');
select has_function_privilege('airports_api.airport_map_points(airports_fn.airport_map_point_options)', 'execute');
select has_function_privilege('airports_api.airport_sync_status()', 'execute');

rollback;
