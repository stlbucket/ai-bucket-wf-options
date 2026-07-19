-- Verify fnb-loc:00000000010340_loc_public_locations on pg

begin;

select is_public from loc.location where false;

select 1/count(*) from information_schema.columns
  where table_schema = 'loc' and table_name = 'location'
    and column_name = 'resident_urn' and is_nullable = 'YES';

select 1/count(*) from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'loc' and c.relname = 'location' and p.polname = 'view_public';

rollback;
