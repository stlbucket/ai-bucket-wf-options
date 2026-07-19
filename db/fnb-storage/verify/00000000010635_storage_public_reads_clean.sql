-- both public read fns must exist AND hard-filter scan_status = 'clean'
select 1/count(*) from pg_proc
  where proname = 'public_asset' and pronamespace = 'storage'::regnamespace
    and prosrc like '%scan_status%';
select 1/count(*) from pg_proc
  where proname = 'public_assets_for_subject' and pronamespace = 'storage'::regnamespace
    and prosrc like '%scan_status%';
