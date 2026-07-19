-- Deploy fnb-loc:00000000010350_loc_geolocated to pg

alter table loc.location add column is_geolocated boolean
  generated always as (lat is not null and lon is not null) stored;
