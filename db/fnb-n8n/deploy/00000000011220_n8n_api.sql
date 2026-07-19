-- Deploy fnb-n8n:00000000011220_n8n_api to pg

begin;

create schema n8n_api;

---------------------------------------------- workflow_runs
-- Recent runs for the site-admin n8n Workflows panel. Diagnostic surface — gated
-- p:app-admin-super. Mirrors agent_api.workflow_runs exactly. Exposed to PostGraphile with a
-- smart-tag rename (n8n_workflow_runs) so it cannot collide with the agent function's field.
CREATE OR REPLACE FUNCTION n8n_api.workflow_runs(
    _workflow_key citext default null
    ,_paging_options app_fn.paging_options default null
  )
  RETURNS setof n8n.workflow_run
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
    from n8n.workflow_run r
    where (_workflow_key is null or r.workflow_key = _workflow_key)
    order by r.started_at desc, r.id
    limit _limit
    offset _offset
    ;
  end;
  $$;

commit;
