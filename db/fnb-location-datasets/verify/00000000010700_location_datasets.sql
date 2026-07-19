-- Verify fnb-location-datasets:00000000010700_location_datasets on pg

begin;

select pg_catalog.has_schema_privilege('location_datasets', 'usage');
select pg_catalog.has_schema_privilege('location_datasets_fn', 'usage');
select pg_catalog.has_schema_privilege('location_datasets_api', 'usage');

select 1/count(*) from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'location_datasets' and t.typname = 'brewery_type';

select id, external_id, location_id, name, brewery_type, phone, website_url, created_at, updated_at
  from location_datasets.brewery where false;

select 1/count(*) from pg_indexes
  where schemaname = 'location_datasets' and indexname = 'idx_uq_brewery_external_id';

rollback;
