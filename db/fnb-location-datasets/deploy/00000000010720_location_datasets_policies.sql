-- Deploy fnb-location-datasets:00000000010720_location_datasets_policies to pg

--- location_datasets_api policies
grant usage on schema location_datasets_api to anon, authenticated, service_role;
grant all on all tables in schema location_datasets_api to anon, authenticated, service_role;
grant all on all routines in schema location_datasets_api to anon, authenticated, service_role;
grant all on all sequences in schema location_datasets_api to anon, authenticated, service_role;
alter default privileges for role postgres in schema location_datasets_api grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema location_datasets_api grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema location_datasets_api grant all on sequences to anon, authenticated, service_role;

--- location_datasets_fn policies
grant usage on schema location_datasets_fn to anon, authenticated, service_role;
grant all on all tables in schema location_datasets_fn to anon, authenticated, service_role;
grant all on all routines in schema location_datasets_fn to anon, authenticated, service_role;
grant all on all sequences in schema location_datasets_fn to anon, authenticated, service_role;
alter default privileges for role postgres in schema location_datasets_fn grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema location_datasets_fn grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema location_datasets_fn grant all on sequences to anon, authenticated, service_role;

--- location_datasets policies
grant usage on schema location_datasets to anon, authenticated, service_role;
grant all on all tables in schema location_datasets to anon, authenticated, service_role;
grant all on all routines in schema location_datasets to anon, authenticated, service_role;
grant all on all sequences in schema location_datasets to anon, authenticated, service_role;
alter default privileges for role postgres in schema location_datasets grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema location_datasets grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema location_datasets grant all on sequences to anon, authenticated, service_role;


------------------------------------------------------------------------ location_datasets
alter table location_datasets.brewery enable row level security;
    CREATE POLICY view_all ON location_datasets.brewery
      FOR SELECT
      USING (true)
      ;
-- no insert/update/delete policies: writes happen only inside
-- location_datasets_fn.upsert_breweries (SECURITY DEFINER) from the worker
