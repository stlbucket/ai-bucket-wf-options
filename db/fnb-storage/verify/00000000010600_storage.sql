select 1/count(*) from information_schema.schemata where schema_name = 'storage';
select id, urn, resident_urn, subject_urn from storage.asset where false;
select id from storage.asset where false;
select wf_id from storage.asset where false;
select 1/count(*) from pg_type where typname = 'scan_status'   and typnamespace = 'storage'::regnamespace;
select 1/count(*) from pg_type where typname = 'asset_status'  and typnamespace = 'storage'::regnamespace;
select 1/count(*) from pg_indexes where schemaname = 'storage' and indexname = 'idx_asset_public';
select 1/count(*) from pg_indexes where schemaname = 'storage' and indexname = 'idx_asset_subject_urn';
-- stacking v2: the pre-registry loose-ref pair is gone
select 1/(1 - count(*)) from information_schema.columns
  where table_schema = 'storage' and table_name = 'asset' and column_name in ('context', 'owning_entity_id');
select 1/(1 - count(*)) from pg_type where typname = 'asset_context' and typnamespace = 'storage'::regnamespace;
