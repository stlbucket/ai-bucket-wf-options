-- Verify fnb:00000000010243_app_fn_support on pg

begin;

select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'become_support';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'exit_support_mode';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'deactivate_tenant';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'search_residents';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_api' and p.proname = 'site_user_by_id';

rollback;
