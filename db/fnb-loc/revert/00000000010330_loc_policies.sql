-- Revert fnb-loc:00000000010330_loc_policies from pg

begin;

drop policy if exists manage_all_for_tenant on loc.location;
alter table loc.location disable row level security;

revoke all on all routines in schema loc_api from anon, authenticated, service_role;
revoke all on all tables in schema loc_api from anon, authenticated, service_role;
revoke usage on schema loc_api from anon, authenticated, service_role;

revoke all on all routines in schema loc_fn from anon, authenticated, service_role;
revoke all on all tables in schema loc_fn from anon, authenticated, service_role;
revoke usage on schema loc_fn from anon, authenticated, service_role;

revoke all on all tables in schema loc from anon, authenticated, service_role;
revoke all on all routines in schema loc from anon, authenticated, service_role;
revoke usage on schema loc from anon, authenticated, service_role;

commit;
