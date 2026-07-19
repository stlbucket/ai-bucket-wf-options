select 1/count(*) from pg_proc where proname = 'resolve_asset_scan' and pronamespace = 'storage_fn'::regnamespace;
