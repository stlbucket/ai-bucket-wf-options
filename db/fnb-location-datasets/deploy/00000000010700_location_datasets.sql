-- Deploy fnb-location-datasets:00000000010700_location_datasets to pg

begin;

create schema location_datasets;
create schema if not exists location_datasets_fn;
create schema if not exists location_datasets_api;

-- the documented vocabulary plus the undocumented values present in live data
-- (live set from /breweries/meta by_type, 2026-07-09: taproom, beergarden, cidery, location)
create type location_datasets.brewery_type as enum (
  'unknown','micro','nano','regional','brewpub','contract','proprietor',
  'planning','closed','large','bar','taproom','beergarden','cidery','location'
);

create table location_datasets.brewery (
  id uuid not null default gen_random_uuid() primary key,
  external_id text not null,
  location_id uuid not null references loc.location(id),
  name citext not null,
  brewery_type location_datasets.brewery_type not null,
  notes text,
  phone text,
  website_url text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create unique index idx_uq_brewery_external_id on location_datasets.brewery(external_id);
create unique index idx_uq_brewery_location_id on location_datasets.brewery(location_id);
create index idx_brewery_name on location_datasets.brewery(name);
create index idx_brewery_type on location_datasets.brewery(brewery_type);

commit;
