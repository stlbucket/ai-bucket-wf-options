-- Verify fnb:00000000010250_app_policies on pg

begin;

-- verify RLS is enabled on key tables
select relname, relrowsecurity from pg_class where relname = 'profile' and relrowsecurity = true;
select relname, relrowsecurity from pg_class where relname = 'resident' and relrowsecurity = true;
select relname, relrowsecurity from pg_class where relname = 'tenant' and relrowsecurity = true;
select relname, relrowsecurity from pg_class where relname = 'license' and relrowsecurity = true;

-- verify key policies exist
select polname from pg_policy where polname = 'view_self';
select polname from pg_policy where polname = 'manage_tenant';
select polname from pg_policy where polname = 'view_own_profile_licenses';

rollback;
