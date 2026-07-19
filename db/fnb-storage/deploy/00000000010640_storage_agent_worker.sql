-- Deploy fnb-storage:00000000010640_storage_agent_worker to pg

begin;

-- Agentic workflow engine (spec: .claude/specs/agentic-workflow-engine/): the asset-scan
-- workflow's tool handlers connect as agent_worker and reach storage data exclusively through
-- _fn functions — the two raw SELECTs the retired worker handlers did become asset_for_scan,
-- and the reaper's stuck-asset query becomes stuck_pending_assets.

-------------------------------------- storage_fn.asset_for_scan (agent get_asset tool)
create or replace function storage_fn.asset_for_scan(_asset_id uuid)
  returns storage.asset
  language plpgsql stable security definer
  as $$
  declare
    _asset storage.asset;
  begin
    select * into _asset from storage.asset where id = _asset_id;
    if _asset.id is null then
      raise exception 'asset not found: %', _asset_id;
    end if;
    return _asset;
  end;
  $$;

-------------------------------------- storage_fn.stuck_pending_assets (deterministic reaper)
-- Returns pending assets older than the threshold whose asset-scan attempt count (rows in
-- agent.workflow_run) is below the cap and that have no currently-running scan; assets AT the
-- cap are flipped to terminal scan_status='error' for operator review (via the idempotent
-- resolve_asset_scan — same semantics as the retired asset-scan-reaper handler).
-- ai_tags_requested is recovered from the most recent prior run's input (false when the asset
-- never got a run — the upload-time trigger POST was lost before any run began).
create or replace function storage_fn.stuck_pending_assets(
    _stuck_minutes int
    ,_max_attempts int
  ) returns table(asset_id uuid, tenant_id uuid, ai_tags_requested boolean)
    language plpgsql volatile security definer
    as $$
  declare
    _at_cap uuid;
  begin
    -- terminal 'error' for assets that exhausted their attempts
    for _at_cap in
      select a.id
      from storage.asset a
      where a.scan_status = 'pending'
        and a.created_at < now() - make_interval(mins => _stuck_minutes)
        and (
          select count(*)
          from agent.workflow_run r
          where r.workflow_key = 'asset-scan'
            and r.input_data->>'assetId' = a.id::text
        ) >= _max_attempts
    loop
      perform storage_fn.resolve_asset_scan(_at_cap, 'error'::storage.scan_status, null, null);
    end loop;

    -- re-fire candidates: still pending, under the cap, no live run
    return query
    select
      a.id
      ,a.tenant_id
      ,coalesce((
        select (r.input_data->>'aiTagsRequested')::boolean
        from agent.workflow_run r
        where r.workflow_key = 'asset-scan'
          and r.input_data->>'assetId' = a.id::text
        order by r.started_at desc
        limit 1
      ), false)
    from storage.asset a
    where a.scan_status = 'pending'
      and a.created_at < now() - make_interval(mins => _stuck_minutes)
      and not exists (
        select 1
        from agent.workflow_run r
        where r.workflow_key = 'asset-scan'
          and r.status = 'running'
          and r.input_data->>'assetId' = a.id::text
      );
  end;
  $$;

-- agent_worker-only surface — no storage_api wrappers, same posture as resolve_asset_scan.
revoke all on function storage_fn.asset_for_scan(uuid) from public, authenticated;
revoke all on function storage_fn.stuck_pending_assets(int, int) from public, authenticated;

grant usage on schema storage to agent_worker;
grant usage on schema storage_fn to agent_worker;
grant execute on function storage_fn.asset_for_scan(uuid) to agent_worker;
grant execute on function storage_fn.stuck_pending_assets(int, int) to agent_worker;
grant execute on function storage_fn.resolve_asset_scan(uuid, storage.scan_status, text, text) to agent_worker;
grant execute on function storage_fn.insert_derived_asset(uuid,uuid,text,text,text,bigint,text,citext[]) to agent_worker;
grant execute on function storage_fn.add_asset_tags(uuid,citext[]) to agent_worker;

commit;
