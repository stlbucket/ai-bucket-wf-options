-- Revert fnb-airports:00000000010820_airports_policies from pg

begin;

drop policy if exists view_all on airports.sync_source;
alter table airports.sync_source disable row level security;
drop policy if exists view_all on airports.navaid;
alter table airports.navaid disable row level security;
drop policy if exists view_all on airports.airport_frequency;
alter table airports.airport_frequency disable row level security;
drop policy if exists view_all on airports.runway;
alter table airports.runway disable row level security;
drop policy if exists view_all on airports.airport;
alter table airports.airport disable row level security;
drop policy if exists view_all on airports.region;
alter table airports.region disable row level security;
drop policy if exists view_all on airports.country;
alter table airports.country disable row level security;

revoke all on all routines in schema airports_api from anon, authenticated, service_role;
revoke all on all tables in schema airports_api from anon, authenticated, service_role;
revoke usage on schema airports_api from anon, authenticated, service_role;

revoke all on all routines in schema airports_fn from anon, authenticated, service_role;
revoke all on all tables in schema airports_fn from anon, authenticated, service_role;
revoke usage on schema airports_fn from anon, authenticated, service_role;

revoke all on all tables in schema airports from anon, authenticated, service_role;
revoke all on all routines in schema airports from anon, authenticated, service_role;
revoke usage on schema airports from anon, authenticated, service_role;

commit;
