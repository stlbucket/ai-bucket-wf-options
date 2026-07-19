-- Verify fnb-airports:00000000010820_airports_policies on pg

begin;

-- integer division: fewer than all seven view_all policies present divides by zero
select 1/(count(*)/7) from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'airports'
    and c.relname in ('country', 'region', 'airport', 'runway', 'airport_frequency', 'navaid', 'sync_source')
    and p.polname = 'view_all';

rollback;
