select 1/count(*) from pg_proc where proname = 'insert_asset' and pronamespace = 'storage_api'::regnamespace;
select 1/count(*) from pg_proc where proname = 'delete_asset' and pronamespace = 'storage_api'::regnamespace;
select 1/count(*) from pg_proc where proname = 'public_asset' and pronamespace = 'storage'::regnamespace;
select 1/count(*) from pg_proc where proname = 'public_assets_for_subject' and pronamespace = 'storage'::regnamespace;
