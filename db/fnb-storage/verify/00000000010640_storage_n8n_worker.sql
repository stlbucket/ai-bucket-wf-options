select 'storage_fn.asset_for_scan'::regproc;
select 'storage_fn.stuck_pending_assets'::regproc;
select pg_catalog.has_function_privilege('n8n_worker', 'storage_fn.asset_for_scan(uuid)', 'execute');
select pg_catalog.has_function_privilege('n8n_worker', 'storage_fn.resolve_asset_scan(uuid, storage.scan_status, text, text)', 'execute');
