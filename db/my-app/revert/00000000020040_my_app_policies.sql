-- Revert my-app:00000000020040_my_app_policies from pg

revoke usage on schema my_app_api from anon, authenticated, service_role;
revoke all on all tables in schema my_app_api from anon, authenticated, service_role;
revoke all on all routines in schema my_app_api from anon, authenticated, service_role;
revoke all on all sequences in schema my_app_api from anon, authenticated, service_role;
alter default privileges for role postgres in schema my_app_api revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema my_app_api revoke all on routines from anon, authenticated, service_role;
alter default privileges for role postgres in schema my_app_api revoke all on sequences from anon, authenticated, service_role;

revoke usage on schema my_app_fn from anon, authenticated, service_role;
revoke all on all tables in schema my_app_fn from anon, authenticated, service_role;
revoke all on all routines in schema my_app_fn from anon, authenticated, service_role;
revoke all on all sequences in schema my_app_fn from anon, authenticated, service_role;
alter default privileges for role postgres in schema my_app_fn revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema my_app_fn revoke all on routines from anon, authenticated, service_role;
alter default privileges for role postgres in schema my_app_fn revoke all on sequences from anon, authenticated, service_role;

revoke usage on schema my_app from anon, authenticated, service_role;
revoke all on all tables in schema my_app from anon, authenticated, service_role;
revoke all on all routines in schema my_app from anon, authenticated, service_role;
revoke all on all sequences in schema my_app from anon, authenticated, service_role;
alter default privileges for role postgres in schema my_app revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema my_app revoke all on routines from anon, authenticated, service_role;
alter default privileges for role postgres in schema my_app revoke all on sequences from anon, authenticated, service_role;
