-- Verify fnb-location-datasets:00000000010720_location_datasets_policies on pg

begin;

select 1/count(*) from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'location_datasets' and c.relname = 'brewery' and p.polname = 'view_all';

rollback;
