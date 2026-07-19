drop policy if exists manage_all_super_admin on storage.asset;
drop policy if exists manage_all_for_tenant on storage.asset;

alter table storage.asset            disable row level security;

revoke execute on function storage.public_assets_for_subject(text) from anon, authenticated;
revoke execute on function storage.public_asset(uuid) from anon, authenticated;

revoke update on storage.asset            from authenticated, service_role;
revoke select on storage.asset            from authenticated, service_role;
revoke usage on schema storage from anon, authenticated, service_role;

revoke execute on all routines in schema storage_fn from authenticated, service_role;
revoke usage on schema storage_fn from authenticated, service_role;

revoke execute on all routines in schema storage_api from authenticated, service_role;
revoke usage on schema storage_api from authenticated, service_role;
