-- Verify fnb:00000000010242_app_fn_definers on pg

begin;

select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'handle_new_user';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'assume_residency';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'invite_user';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_api' and p.proname = 'update_profile';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_api' and p.proname = 'assume_residency';

rollback;
