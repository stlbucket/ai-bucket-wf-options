-------------------------------------- insert_asset
create or replace function storage_fn.insert_asset(
    _info storage_fn.asset_info
    ,_resident_id uuid
  ) returns storage.asset
    language plpgsql volatile security definer
    as $$
  declare
    _resident app.resident;
    _asset storage.asset;
  begin
    select * into _resident from app.resident where id = _resident_id;
    if _resident.id is null then
      raise exception 'no resident for id: %', _resident_id;
    end if;

    -- stacking guard: the caller must be able to SEE the subject in the registry.
    -- This fn is SECURITY DEFINER (RLS on res.resource does not fire), so the check
    -- mirrors the registry SELECT policy explicitly via jwt.* (claims are set by the
    -- withClaims carve-out that calls this).
    if _info.subject_urn is not null then
      perform 1 from res.resource r
      where r.urn = _info.subject_urn
        and (
          jwt.has_permission('p:app-admin-super')
          or exists (
            select 1 from res.module_permission mp
            where mp.module = r.module
              and (
                (mp.permission_key is not null
                  and jwt.has_permission(mp.permission_key, r.tenant_id))
                or (mp.permission_key is null and jwt.tenant_id() = r.tenant_id)
              )
          )
        );
      if not found then
        raise exception '30000: NOT AUTHORIZED';
      end if;
    end if;

    insert into storage.asset(
      id
      ,tenant_id
      ,resident_urn
      ,is_public
      ,original_name
      ,extension
      ,content_type
      ,size_bytes
      ,bucket
      ,storage_key
      ,checksum_sha256
      ,scan_status
      ,scan_signature
      ,tags
      ,subject_urn
    )
    select
      coalesce(_info.id, gen_random_uuid())
      ,_resident.tenant_id
      ,_resident.urn
      ,coalesce(_info.is_public, false)
      ,_info.original_name
      ,_info.extension
      ,_info.content_type
      ,_info.size_bytes
      ,_info.bucket
      ,_info.storage_key
      ,_info.checksum_sha256
      ,coalesce(_info.scan_status, 'pending')
      ,_info.scan_signature
      ,coalesce(_info.tags, '{}'::citext[])
      ,_info.subject_urn
    returning *
    into _asset
    ;
    perform res_fn.register_resource(_asset.id, _asset.tenant_id, 'storage', 'asset', _resident_id);

    return _asset;
  end;
  $$;
