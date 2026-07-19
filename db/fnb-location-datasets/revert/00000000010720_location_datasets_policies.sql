-- Revert fnb-location-datasets:00000000010720_location_datasets_policies from pg

begin;

drop policy if exists view_all on location_datasets.brewery;
alter table location_datasets.brewery disable row level security;

revoke all on all routines in schema location_datasets_api from anon, authenticated, service_role;
revoke all on all tables in schema location_datasets_api from anon, authenticated, service_role;
revoke usage on schema location_datasets_api from anon, authenticated, service_role;

revoke all on all routines in schema location_datasets_fn from anon, authenticated, service_role;
revoke all on all tables in schema location_datasets_fn from anon, authenticated, service_role;
revoke usage on schema location_datasets_fn from anon, authenticated, service_role;

revoke all on all tables in schema location_datasets from anon, authenticated, service_role;
revoke all on all routines in schema location_datasets from anon, authenticated, service_role;
revoke usage on schema location_datasets from anon, authenticated, service_role;

commit;
