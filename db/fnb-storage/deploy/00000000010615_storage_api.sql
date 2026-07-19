-------------------------------------- storage_api.insert_asset (permission gate)
create or replace function storage_api.insert_asset(_info storage_fn.asset_info)
  returns storage.asset language plpgsql volatile security invoker as $$
begin
  perform jwt.enforce_any_permission(array['p:app-admin','p:app-user']::citext[]);
  return storage_fn.insert_asset(_info, jwt.resident_id());
end; $$;

-------------------------------------- storage_api.delete_asset (soft-delete + child cascade)
-- SECURITY INVOKER: RLS scopes exactly which rows the caller may touch (own-tenant via
-- manage_all_for_tenant, or any via manage_all_super_admin). A cross-tenant caller updates
-- 0 rows — no extra tenant gate needed. Do NOT delegate to a SECURITY DEFINER helper, which
-- would bypass RLS and let any p:app-user delete cross-tenant. Returns the affected rows so
-- the endpoint knows which (bucket, storage_key) objects to purge from MinIO.
create or replace function storage_api.delete_asset(_id uuid)
  returns setof storage.asset
  language plpgsql volatile security invoker as $$
begin
  perform jwt.enforce_any_permission(array['p:app-admin','p:app-user']::citext[]);
  return query
    update storage.asset
       set asset_status = 'deleted', updated_at = current_timestamp
     where (id = _id or parent_asset_id = _id)   -- asset + derived children
       and asset_status = 'active'
    returning *;
end; $$;

-------------------------------------- public reads (fetch-by-reference)
-- Live in the exposed `storage` schema so PostGraphile publishes them as query fields,
-- while insert_asset stays hidden in storage_api. Both hard-filter is_public + active,
-- so they are safe to grant to anon.

-- returns 0/1 row for a known asset id, only if public + active
create or replace function storage.public_asset(_id uuid)
  returns setof storage.asset
  language sql stable security definer set search_path = '' as $$
    select a.* from storage.asset a
    where a.id = _id and a.is_public and a.asset_status = 'active';
  $$;

-- public assets attached to a subject (the "query related files" access, public variant)
create or replace function storage.public_assets_for_subject(_subject_urn text)
  returns setof storage.asset
  language sql stable security definer set search_path = '' as $$
    select a.* from storage.asset a
    where a.subject_urn = _subject_urn
      and a.is_public and a.asset_status = 'active'
    order by a.created_at desc;
  $$;
