create schema loc;
create schema if not exists loc_api;
create schema if not exists loc_fn;

create type loc_fn.location_info as (
  id uuid,
  name text,
  address1 text,
  address2 text,
  city text,
  state text,
  postal_code text,
  country text,
  lat text,
  lon text
);

create type loc_fn.search_locations_options as (
  search_term citext
  ,paging_options app_fn.paging_options
);

create table loc.location (
  id uuid NOT NULL DEFAULT gen_random_uuid() primary key,
  tenant_id uuid not null references app.tenant(id),
  resident_urn text not null references res.resource(urn),
  name text,
  address1 text,
  address2 text,
  city text,
  state text,
  postal_code text,
  country text,
  -- latlon geography (POINT),
  lat text,
  lon text,
  urn text not null
    generated always as (res_fn.build_urn(tenant_id, 'loc', 'location', id)) stored,
  constraint uq_location_urn unique (urn),
  constraint fk_location_resource foreign key (id) references res.resource(id)
    deferrable initially deferred
);

-- create index idx_location_latlon
--   on loc.location
--   using GIST (latlon);
