-- Revert fnb-location-datasets:00000000010700_location_datasets from pg

begin;

drop schema if exists location_datasets_api cascade;
drop schema if exists location_datasets_fn cascade;
drop schema if exists location_datasets cascade;

commit;
