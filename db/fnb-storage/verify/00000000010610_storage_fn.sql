select 1/count(*) from pg_proc where proname = 'insert_asset' and pronamespace = 'storage_fn'::regnamespace;
