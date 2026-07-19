-- Verify fnb:00000000010240_app_fn on pg

begin;

select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'install_application';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'install_anchor_application';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'create_anchor_tenant';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'create_tenant';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_api' and p.proname = 'current_profile_claims';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_api' and p.proname = 'subscribe_tenant_to_license_pack';

rollback;
