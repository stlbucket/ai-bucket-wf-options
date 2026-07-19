-- Revert fnb:00000000010250_app_policies from pg

begin;

-- drop RLS policies
drop policy if exists view_all_users on app.permission;
drop policy if exists view_all_users on app.license_type_permission;
drop policy if exists view_all_users on app.license_type;
drop policy if exists view_all_users on app.license_pack_license_type;
drop policy if exists view_all_users on app.license_pack;
drop policy if exists view_all_users on app.application;
drop policy if exists manage_license on app.license;
drop policy if exists view_own_tenant_licenses on app.license;
drop policy if exists view_own_profile_licenses on app.license;
drop policy if exists manage_tenant_subscription on app.tenant_subscription;
drop policy if exists view_own_tenant_subscriptions on app.tenant_subscription;
drop policy if exists manage_tenant on app.tenant;
drop policy if exists manage_own_tenant_admin on app.tenant;
drop policy if exists view_own_tenant_user on app.tenant;
drop policy if exists manage_own_tenant_residencies on app.resident;
drop policy if exists update_own_resident on app.resident;
drop policy if exists view_own_resident on app.resident;
drop policy if exists view_own_resident_email on app.resident;
drop policy if exists manage_all_super_admin on app.profile;
drop policy if exists update_self on app.profile;
drop policy if exists view_self on app.profile;

-- disable RLS
alter table app.permission disable row level security;
alter table app.license_type_permission disable row level security;
alter table app.license_type disable row level security;
alter table app.license_pack_license_type disable row level security;
alter table app.license_pack disable row level security;
alter table app.application disable row level security;
alter table app.license disable row level security;
alter table app.tenant_subscription disable row level security;
alter table app.tenant disable row level security;
alter table app.resident disable row level security;
alter table app.profile disable row level security;

-- revoke grants
revoke all on all routines in schema app from anon, authenticated, service_role;
revoke all on all tables in schema app from anon, authenticated, service_role;
revoke all on all sequences in schema app from anon, authenticated, service_role;
revoke usage on schema app from anon, authenticated, service_role;

revoke all on all routines in schema app_fn from anon, authenticated, service_role;
revoke all on all tables in schema app_fn from anon, authenticated, service_role;
revoke all on all sequences in schema app_fn from anon, authenticated, service_role;
revoke usage on schema app_fn from anon, authenticated, service_role;

revoke all on all routines in schema app_api from anon, authenticated, service_role;
revoke all on all tables in schema app_api from anon, authenticated, service_role;
revoke all on all sequences in schema app_api from anon, authenticated, service_role;
revoke usage on schema app_api from anon, authenticated, service_role;

commit;
