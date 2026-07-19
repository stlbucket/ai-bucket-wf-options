select 1/count(*) from information_schema.schemata where schema_name = 'storage_fn';
select 1/count(*) from information_schema.schemata where schema_name = 'storage_api';
select 1/count(*) from pg_type where typname = 'asset_info' and typnamespace = 'storage_fn'::regnamespace;
