-- Verify fnb-loc:00000000010300_loc on pg

begin;

select n.nspname from pg_namespace n where n.nspname = 'loc';
select n.nspname from pg_namespace n where n.nspname = 'loc_api';
select n.nspname from pg_namespace n where n.nspname = 'loc_fn';

select id, name, address1, address2, city, state, postal_code, country, lat, lon from loc.location where false;
select id, urn, resident_urn from loc.location where false;

rollback;
