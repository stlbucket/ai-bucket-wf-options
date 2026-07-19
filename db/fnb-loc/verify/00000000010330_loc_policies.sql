-- Verify fnb-loc:00000000010330_loc_policies on pg

begin;

select p.polname from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'loc' and c.relname = 'location' and p.polname = 'manage_all_for_tenant';

rollback;
