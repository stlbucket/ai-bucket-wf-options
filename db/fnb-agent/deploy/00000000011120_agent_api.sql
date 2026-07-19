-- Deploy fnb-agent:00000000011120_agent_api to pg

begin;

create schema agent_api;

---------------------------------------------- workflow_runs
-- Recent runs for an admin/status panel. Diagnostic surface — gated p:app-admin-super.
CREATE OR REPLACE FUNCTION agent_api.workflow_runs(
    _workflow_key citext default null
    ,_paging_options app_fn.paging_options default null
  )
  RETURNS setof agent.workflow_run
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $$
  DECLARE
    _limit int := coalesce((_paging_options).item_limit, 25);
    _offset int;
  BEGIN
    PERFORM jwt.enforce_permission('p:app-admin-super');

    _offset := coalesce(
      (_paging_options).item_offset
      ,coalesce((_paging_options).page_offset, 0) * _limit
    );

    return query
    select r.*
    from agent.workflow_run r
    where (_workflow_key is null or r.workflow_key = _workflow_key)
    order by r.started_at desc, r.id
    limit _limit
    offset _offset
    ;
  end;
  $$;

commit;
