-- Verify fnb-airports:00000000010800_airports on pg

begin;

select pg_catalog.has_schema_privilege('airports', 'usage');
select pg_catalog.has_schema_privilege('airports_fn', 'usage');
select pg_catalog.has_schema_privilege('airports_api', 'usage');

-- integer division: fewer than all five enums present divides by zero
select 1/(count(*)/5) from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'airports'
    and t.typname in ('airport_type', 'continent', 'navaid_type', 'navaid_usage_type', 'navaid_power');

select id, external_id, code, name, continent, wikipedia_link, keywords, notes, created_at, updated_at
  from airports.country where false;

select id, external_id, code, local_code, name, continent, iso_country, wikipedia_link, keywords, notes
  from airports.region where false;

select id, external_id, ident, type, name, location_id, elevation_ft, continent, iso_country,
    iso_region, scheduled_service, icao_code, iata_code, gps_code, local_code, home_link,
    wikipedia_link, keywords, notes, created_at, updated_at
  from airports.airport where false;

select id, external_id, airport_id, length_ft, width_ft, surface, lighted, closed,
    le_ident, le_latitude_deg, le_longitude_deg, le_elevation_ft, le_heading_deg_t,
    le_displaced_threshold_ft, he_ident, he_latitude_deg, he_longitude_deg, he_elevation_ft,
    he_heading_deg_t, he_displaced_threshold_ft
  from airports.runway where false;

select id, external_id, airport_id, type, description, frequency_mhz
  from airports.airport_frequency where false;

select id, external_id, ident, name, type, frequency_khz, latitude_deg, longitude_deg,
    elevation_ft, iso_country, dme_frequency_khz, dme_channel, dme_latitude_deg,
    dme_longitude_deg, dme_elevation_ft, slaved_variation_deg, magnetic_variation_deg,
    usage_type, power, associated_airport_ident, associated_airport_id, notes
  from airports.navaid where false;

select file, etag, last_modified, row_count, synced_at
  from airports.sync_source where false;

select 1/count(*) from pg_indexes
  where schemaname = 'airports' and indexname = 'idx_uq_airport_external_id';

rollback;
