-- RLS policies
drop policy if exists create_for_tenant on msg.message;
drop policy if exists view_all_for_tenant on msg.message;
alter table msg.message disable row level security;

drop policy if exists create_for_tenant on msg.subscriber;
drop policy if exists view_all_for_tenant on msg.subscriber;
alter table msg.subscriber disable row level security;

drop policy if exists create_for_tenant on msg.topic;
drop policy if exists view_all_for_tenant on msg.topic;
alter table msg.topic disable row level security;

-- Revoke default privileges
alter default privileges for role postgres in schema msg revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema msg revoke all on routines from anon, authenticated, service_role;
alter default privileges for role postgres in schema msg revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema msg_fn revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema msg_fn revoke all on routines from anon, authenticated, service_role;
alter default privileges for role postgres in schema msg_fn revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema msg_api revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema msg_api revoke all on routines from anon, authenticated, service_role;
alter default privileges for role postgres in schema msg_api revoke all on sequences from anon, authenticated, service_role;

-- Revoke grants
revoke all on all routines in schema msg from anon, authenticated, service_role;
revoke all on all sequences in schema msg from anon, authenticated, service_role;
revoke all on all tables in schema msg from anon, authenticated, service_role;
revoke usage on schema msg from anon, authenticated, service_role;

revoke all on all routines in schema msg_fn from anon, authenticated, service_role;
revoke all on all sequences in schema msg_fn from anon, authenticated, service_role;
revoke all on all tables in schema msg_fn from anon, authenticated, service_role;
revoke usage on schema msg_fn from anon, authenticated, service_role;

revoke all on all routines in schema msg_api from anon, authenticated, service_role;
revoke all on all sequences in schema msg_api from anon, authenticated, service_role;
revoke all on all tables in schema msg_api from anon, authenticated, service_role;
revoke usage on schema msg_api from anon, authenticated, service_role;
