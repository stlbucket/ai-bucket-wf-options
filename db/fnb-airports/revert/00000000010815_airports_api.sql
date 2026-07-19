-- Revert fnb-airports:00000000010815_airports_api from pg

begin;

drop function if exists airports_api.airport_sync_status();
drop function if exists airports_api.airport_map_points(airports_fn.airport_map_point_options);
drop function if exists airports_api.search_airports(airports_fn.search_airports_options);

commit;
