-- Deploy fnb-airports:00000000010800_airports to pg

begin;

create schema airports;
create schema if not exists airports_fn;
create schema if not exists airports_api;

-- OurAirports vocabularies verified against live data 2026-07-09 (.claude/skills/airports-expert).
-- All enums are OPEN: 'unknown' is the coercion sentinel for upstream drift (the data dictionary
-- already disagrees with the data — it documents 'closed_airport'; the live value is 'closed').
create type airports.airport_type as enum (
  'unknown','balloonport','closed','heliport','large_airport','medium_airport',
  'seaplane_base','small_airport'
);

create type airports.continent as enum (
  'unknown','AF','AN','AS','EU','NA','OC','SA'
);

create type airports.navaid_type as enum (
  'unknown','NDB','NDB-DME','DME','VOR','VOR-DME','VORTAC','TACAN'
);

-- upstream is UPPERCASE (LO/HI/BOTH/TERMINAL/RNAV); coerced case-insensitively
create type airports.navaid_usage_type as enum (
  'unknown','lo','hi','both','terminal','rnav'
);

-- upstream has a literal 'UNKNOWN' plus empties — both coerce to 'unknown'
create type airports.navaid_power as enum (
  'unknown','low','medium','high'
);

-- NOT enums (verified free text upstream): runway.surface (664 distinct values),
-- airport_frequency.type (549 distinct values).

create table airports.country (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,
  code citext not null,
  name text not null,
  continent airports.continent not null default 'unknown',
  wikipedia_link text,
  keywords text,
  notes text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create unique index idx_uq_country_external_id on airports.country(external_id);
create unique index idx_uq_country_code on airports.country(code);

create table airports.region (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,
  code citext not null,
  local_code text,
  name text not null,
  continent airports.continent not null default 'unknown',
  iso_country citext not null,
  wikipedia_link text,
  keywords text,
  notes text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create unique index idx_uq_region_external_id on airports.region(external_id);
create unique index idx_uq_region_code on airports.region(code);
create index idx_region_iso_country on airports.region(iso_country);

create table airports.airport (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,
  ident citext not null,
  type airports.airport_type not null default 'unknown',
  name citext not null,
  location_id uuid not null references loc.location(id),
  elevation_ft integer,
  continent airports.continent not null default 'unknown',
  iso_country citext not null,
  iso_region citext not null,
  scheduled_service boolean not null default false,
  icao_code citext,
  iata_code citext,
  gps_code citext,
  local_code text,
  home_link text,
  wikipedia_link text,
  keywords text,
  notes text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create unique index idx_uq_airport_external_id on airports.airport(external_id);
create unique index idx_uq_airport_ident on airports.airport(ident);
create unique index idx_uq_airport_location_id on airports.airport(location_id);
create index idx_airport_name on airports.airport(name);
create index idx_airport_type on airports.airport(type);
create index idx_airport_iso_country on airports.airport(iso_country);
create index idx_airport_iso_region on airports.airport(iso_region);
create index idx_airport_iata_code on airports.airport(iata_code);

create table airports.runway (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,
  airport_id uuid not null references airports.airport(id),
  length_ft integer,
  width_ft integer,
  surface text,
  lighted boolean not null default false,
  closed boolean not null default false,
  le_ident text,
  le_latitude_deg text,
  le_longitude_deg text,
  le_elevation_ft integer,
  le_heading_deg_t numeric,
  le_displaced_threshold_ft integer,
  he_ident text,
  he_latitude_deg text,
  he_longitude_deg text,
  he_elevation_ft integer,
  he_heading_deg_t numeric,
  he_displaced_threshold_ft integer,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create unique index idx_uq_runway_external_id on airports.runway(external_id);
create index idx_runway_airport_id on airports.runway(airport_id);

create table airports.airport_frequency (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,
  airport_id uuid not null references airports.airport(id),
  type text,
  description text,
  frequency_mhz numeric,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create unique index idx_uq_airport_frequency_external_id on airports.airport_frequency(external_id);
create index idx_airport_frequency_airport_id on airports.airport_frequency(airport_id);

create table airports.navaid (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,
  ident citext,
  name text not null,
  type airports.navaid_type not null default 'unknown',
  frequency_khz numeric,
  latitude_deg text,
  longitude_deg text,
  elevation_ft integer,
  iso_country citext,
  dme_frequency_khz numeric,
  dme_channel text,
  dme_latitude_deg text,
  dme_longitude_deg text,
  dme_elevation_ft integer,
  slaved_variation_deg numeric,
  magnetic_variation_deg numeric,
  usage_type airports.navaid_usage_type not null default 'unknown',
  power airports.navaid_power not null default 'unknown',
  associated_airport_ident citext,
  associated_airport_id uuid references airports.airport(id),
  notes text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create unique index idx_uq_navaid_external_id on airports.navaid(external_id);
create index idx_navaid_associated_airport_id on airports.navaid(associated_airport_id);

-- per-file sync bookkeeping: status line + conditional-GET (ETag) skips
create table airports.sync_source (
  file citext primary key,
  etag text,
  last_modified text,
  row_count integer not null default 0,
  synced_at timestamptz not null default current_timestamp
);

commit;
