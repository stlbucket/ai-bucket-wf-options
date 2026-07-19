-- Verify fnb-loc:00000000010310_loc_fn on pg

begin;

select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'loc_fn' and p.proname = 'create_location';

select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'loc_api' and p.proname = 'create_location';

select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'loc_fn' and p.proname = 'delete_location';

select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'loc_api' and p.proname = 'delete_location';

select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'loc_fn' and p.proname = 'update_location';

select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'loc_api' and p.proname = 'update_location';

rollback;
