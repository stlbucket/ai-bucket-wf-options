-------------------------------------- storage_fn.resolve_asset_scan (idempotent verdict writer)
-- Called by the `resolve-asset` workflow handler over the worker's service connection.
-- Guards on the current status so a retried/duplicated run is a no-op (idempotency).
-- Not user-callable: no storage_api wrapper; execute granted to service_role only.
create or replace function storage_fn.resolve_asset_scan(
    _asset_id uuid
    ,_verdict storage.scan_status          -- 'clean' | 'infected' | 'error'
    ,_scan_signature text                  -- ClamAV signature when infected, else null
    ,_final_storage_key text               -- final public|private key when clean, else null
  ) returns storage.asset
    language plpgsql volatile security definer
    as $$
  declare
    _asset storage.asset;
  begin
    select * into _asset from storage.asset where id = _asset_id for update;
    if _asset.id is null then
      raise exception 'asset not found: %', _asset_id;
    end if;
    if _asset.scan_status != 'pending' then
      return _asset;   -- already resolved; idempotent no-op
    end if;

    update storage.asset set
      scan_status = _verdict
      ,scan_signature = _scan_signature
      ,storage_key = coalesce(_final_storage_key, storage_key)
      ,asset_status = case when _verdict = 'infected' then 'deleted' else asset_status end
      ,updated_at = current_timestamp
    where id = _asset_id
    returning * into _asset;

    return _asset;
  end;
  $$;

-- Only the worker (service role) executes this — never a logged-in user.
revoke all on function storage_fn.resolve_asset_scan(uuid, storage.scan_status, text, text) from public;
revoke all on function storage_fn.resolve_asset_scan(uuid, storage.scan_status, text, text) from authenticated;
grant execute on function storage_fn.resolve_asset_scan(uuid, storage.scan_status, text, text) to service_role;

-------------------------------------- storage_fn.insert_derived_asset (worker-only; born clean)
-- Inserts a derived asset (v1: the thumbnail) for an existing parent. The parent has already been
-- scanned clean and promoted, so the derived bytes are trusted: written straight to the final
-- prefix (never quarantine/), born scan_status='clean', never scanned. Inherits the parent's
-- tenant/resident/subject_urn/is_public/bucket/original_name. Idempotent: a re-run that
-- finds an existing 'thumbnail' child returns it instead of inserting a duplicate.
create or replace function storage_fn.insert_derived_asset(
    _parent_asset_id uuid
    ,_id uuid                 -- app-generated so the row id matches the storage_key uuid
    ,_storage_key text        -- final-prefix key (derived assets NEVER touch quarantine/)
    ,_extension text
    ,_content_type text
    ,_size_bytes bigint
    ,_checksum_sha256 text
    ,_tags citext[]           -- v1 always array['thumbnail']
  ) returns storage.asset
    language plpgsql volatile security definer
    as $$
  declare
    _parent storage.asset;
    _asset storage.asset;
  begin
    -- 1. load parent (raise if missing)
    select * into _parent from storage.asset where id = _parent_asset_id;
    if _parent.id is null then
      raise exception 'parent asset not found: %', _parent_asset_id;
    end if;

    -- 2. IDEMPOTENCY: an existing 'thumbnail' child for this parent short-circuits (no duplicate)
    select * into _asset
    from storage.asset
    where parent_asset_id = _parent_asset_id
    and 'thumbnail' = any(tags)
    limit 1;
    if _asset.id is not null then
      return _asset;
    end if;

    -- 3. insert — inherits display/scoping metadata from the parent; born clean; parent-linked
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
      ,asset_status
      ,parent_asset_id
      ,tags
      ,subject_urn
    )
    values (
      coalesce(_id, gen_random_uuid())
      ,_parent.tenant_id
      ,_parent.resident_urn
      ,_parent.is_public
      ,_parent.original_name          -- verbatim — display metadata
      ,_extension
      ,_content_type
      ,_size_bytes
      ,_parent.bucket
      ,_storage_key
      ,_checksum_sha256
      ,'clean'                        -- born clean — see Tags + derived assets (_shared.data.md)
      ,'active'
      ,_parent_asset_id
      ,coalesce(_tags, '{}'::citext[])  -- children do NOT inherit the parent's user tags
      ,_parent.subject_urn              -- stacking: derivative attaches to the parent's subject
    )
    returning * into _asset;
    perform res_fn.register_resource(_asset.id, _asset.tenant_id, 'storage', 'asset');

    return _asset;
  end;
  $$;

-------------------------------------- storage_fn.add_asset_tags (worker-only; set-union append)
-- Appends tags to an asset without duplicating (set-union), bumping updated_at. Used by the
-- ai-tag-asset step to append 'ai-tags-coming-soon'; re-runs cannot duplicate.
create or replace function storage_fn.add_asset_tags(
    _asset_id uuid
    ,_tags citext[]
  ) returns storage.asset
    language plpgsql volatile security definer
    as $$
  declare
    _asset storage.asset;
  begin
    update storage.asset set
      tags = (select array_agg(distinct t) from unnest(tags || _tags) t)
      ,updated_at = current_timestamp
    where id = _asset_id
    returning * into _asset;

    if _asset.id is null then
      raise exception 'asset not found: %', _asset_id;
    end if;

    return _asset;
  end;
  $$;

-- Same worker-only grant posture as resolve_asset_scan — no storage_api wrappers.
revoke all on function storage_fn.insert_derived_asset(uuid,uuid,text,text,text,bigint,text,citext[]) from public, authenticated;
grant execute on function storage_fn.insert_derived_asset(uuid,uuid,text,text,text,bigint,text,citext[]) to service_role;
revoke all on function storage_fn.add_asset_tags(uuid,citext[]) from public, authenticated;
grant execute on function storage_fn.add_asset_tags(uuid,citext[]) to service_role;
