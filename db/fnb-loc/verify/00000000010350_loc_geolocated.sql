-- Verify fnb-loc:00000000010350_loc_geolocated on pg

begin;

select is_geolocated from loc.location where false;

select 1/count(*) from information_schema.columns
  where table_schema = 'loc' and table_name = 'location'
    and column_name = 'is_geolocated' and is_generated = 'ALWAYS';

rollback;
