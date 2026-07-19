-- ============================================================================
-- Grants — deliberately NOT the blanket "grant all to anon" pattern used by msg.
-- anon must not be able to enumerate assets; it reads public assets only via the
-- SECURITY DEFINER storage.public_asset* functions (fetch-by-reference).
-- ============================================================================

--- storage_api: authenticated calls the insert gate
grant usage on schema storage_api to authenticated, service_role;
grant execute on all routines in schema storage_api to authenticated, service_role;
alter default privileges for role postgres in schema storage_api grant execute on routines to authenticated, service_role;

--- storage_fn: the INVOKER gate (storage_api.insert_asset) must reach storage_fn.insert_asset
grant usage on schema storage_fn to authenticated, service_role;
grant execute on all routines in schema storage_fn to authenticated, service_role;
alter default privileges for role postgres in schema storage_fn grant execute on routines to authenticated, service_role;

--- storage: authenticated reads the tables (RLS-scoped); anon needs usage only to call the public fns
grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.asset            to authenticated, service_role;   -- NOT anon
grant update on storage.asset            to authenticated, service_role;   -- storage_api.delete_asset (SECURITY INVOKER) soft-deletes; RLS scopes rows. NOT anon

-- public reads (fetch-by-reference) — safe for anon (hard-filter is_public + active)
grant execute on function storage.public_asset(uuid) to anon, authenticated;
grant execute on function storage.public_assets_for_subject(text) to anon, authenticated;

-- ============================================================================
-- RLS — two policies per table: own-tenant users manage their rows; super-admins
-- see all (cross-tenant), mirroring app.*'s manage_all_super_admin pattern
-- (db/fnb-app/deploy/00000000010250_app_policies.sql:38-40). No anon/public policy.
-- ============================================================================

------------------------------------------------------------------------ asset
alter table storage.asset enable row level security;
    -- p:app-user OR p:app-admin — mirrors the write gates in storage_api (enforce_any_permission);
    -- tenant admins hold app-admin only (no p:app-user), so a user-only key hides all assets from them.
    create policy manage_all_for_tenant on storage.asset
      for all
      using (
        jwt.has_permission('p:app-user', tenant_id)
        or jwt.has_permission('p:app-admin', tenant_id)
      );
    create policy manage_all_super_admin on storage.asset
      for all
      using (jwt.has_permission('p:app-admin-super'));
