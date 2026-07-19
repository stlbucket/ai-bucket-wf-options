-- Deploy fnb-airports:00000000010820_airports_policies to pg

--- airports_api policies
grant usage on schema airports_api to anon, authenticated, service_role;
grant all on all tables in schema airports_api to anon, authenticated, service_role;
grant all on all routines in schema airports_api to anon, authenticated, service_role;
grant all on all sequences in schema airports_api to anon, authenticated, service_role;
alter default privileges for role postgres in schema airports_api grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema airports_api grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema airports_api grant all on sequences to anon, authenticated, service_role;

--- airports_fn policies
grant usage on schema airports_fn to anon, authenticated, service_role;
grant all on all tables in schema airports_fn to anon, authenticated, service_role;
grant all on all routines in schema airports_fn to anon, authenticated, service_role;
grant all on all sequences in schema airports_fn to anon, authenticated, service_role;
alter default privileges for role postgres in schema airports_fn grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema airports_fn grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema airports_fn grant all on sequences to anon, authenticated, service_role;

--- airports policies
grant usage on schema airports to anon, authenticated, service_role;
grant all on all tables in schema airports to anon, authenticated, service_role;
grant all on all routines in schema airports to anon, authenticated, service_role;
grant all on all sequences in schema airports to anon, authenticated, service_role;
alter default privileges for role postgres in schema airports grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema airports grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema airports grant all on sequences to anon, authenticated, service_role;


------------------------------------------------------------------------ airports
-- read-only public catalog: SELECT for everyone, no insert/update/delete policies —
-- writes happen only inside airports_fn.* (SECURITY DEFINER) from the worker
alter table airports.country enable row level security;
    CREATE POLICY view_all ON airports.country
      FOR SELECT
      USING (true)
      ;

alter table airports.region enable row level security;
    CREATE POLICY view_all ON airports.region
      FOR SELECT
      USING (true)
      ;

alter table airports.airport enable row level security;
    CREATE POLICY view_all ON airports.airport
      FOR SELECT
      USING (true)
      ;

alter table airports.runway enable row level security;
    CREATE POLICY view_all ON airports.runway
      FOR SELECT
      USING (true)
      ;

alter table airports.airport_frequency enable row level security;
    CREATE POLICY view_all ON airports.airport_frequency
      FOR SELECT
      USING (true)
      ;

alter table airports.navaid enable row level security;
    CREATE POLICY view_all ON airports.navaid
      FOR SELECT
      USING (true)
      ;

alter table airports.sync_source enable row level security;
    CREATE POLICY view_all ON airports.sync_source
      FOR SELECT
      USING (true)
      ;
