-- Deploy fnb-agent:00000000011110_agent_fn to pg

begin;

create schema agent_fn;

-- All terminal-state writes are HARNESS-OWNED (agent-app's agent-harness.ts): no function here
-- is ever called at the model's discretion — tools call _fn functions in other modules; the
-- harness (and the trigger route / reaper) call these over the agent_worker connection.

---------------------------------------------- begin_run -- trigger route, before the SDK run
CREATE OR REPLACE FUNCTION agent_fn.begin_run(
    _workflow_key citext
    ,_input_data jsonb default '{}'::jsonb
    ,_tenant_id uuid default null
    ,_model text default null
  )
  RETURNS uuid
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _run_id uuid;
  BEGIN
    insert into agent.workflow_run(workflow_key, input_data, tenant_id, model)
    values (_workflow_key, coalesce(_input_data, '{}'::jsonb), _tenant_id, _model)
    returning id into _run_id;

    return _run_id;
  end;
  $$;

---------------------------------------------- attach_session -- harness, on the SDK init message
CREATE OR REPLACE FUNCTION agent_fn.attach_session(
    _run_id uuid
    ,_agent_session_id text
  )
  RETURNS void
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  BEGIN
    update agent.workflow_run set
      agent_session_id = _agent_session_id
    where id = _run_id;
  end;
  $$;

---------------------------------------------- complete_run -- harness, after the terminal tool
CREATE OR REPLACE FUNCTION agent_fn.complete_run(
    _run_id uuid
    ,_result_data jsonb default '{}'::jsonb
    ,_usage jsonb default '{}'::jsonb
  )
  RETURNS agent.workflow_run
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _run agent.workflow_run;
  BEGIN
    update agent.workflow_run set
      status = 'success'
      ,result_data = coalesce(_result_data, '{}'::jsonb)
      ,usage = coalesce(_usage, '{}'::jsonb)
      ,finished_at = current_timestamp
    where id = _run_id
    returning * into _run;

    if _run.id is null then
      raise exception 'workflow run not found: %', _run_id;
    end if;

    return _run;
  end;
  $$;

---------------------------------------------- error_run -- harness catch-all (SDK error,
-- wall-clock timeout, maxTurns exhausted, run ended without the terminal tool)
CREATE OR REPLACE FUNCTION agent_fn.error_run(
    _run_id uuid
    ,_error jsonb
    ,_usage jsonb default '{}'::jsonb
  )
  RETURNS agent.workflow_run
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _run agent.workflow_run;
  BEGIN
    update agent.workflow_run set
      status = 'error'
      ,error = coalesce(_error, '{}'::jsonb)
      ,usage = coalesce(_usage, '{}'::jsonb)
      ,finished_at = current_timestamp
    where id = _run_id
    returning * into _run;

    if _run.id is null then
      raise exception 'workflow run not found: %', _run_id;
    end if;

    return _run;
  end;
  $$;

---------------------------------------------- sweep_orphaned_runs -- agent-app boot plugin
-- A restart kills every in-flight SDK run with the process, so at boot any 'running' row is
-- by definition orphaned — without this sweep a stranded row would block singleton workflows
-- forever. Returns the number of rows flipped to error.
CREATE OR REPLACE FUNCTION agent_fn.sweep_orphaned_runs()
  RETURNS int
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _count int;
  BEGIN
    update agent.workflow_run set
      status = 'error'
      ,error = jsonb_build_object('reason', 'orphaned-by-restart')
      ,finished_at = current_timestamp
    where status = 'running';

    GET DIAGNOSTICS _count = ROW_COUNT;
    return _count;
  end;
  $$;

---------------------------------------------- running_count -- sync-status fns, reaper,
-- trigger-route singleton guard
CREATE OR REPLACE FUNCTION agent_fn.running_count(_workflow_key citext)
  RETURNS int
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $$
  DECLARE
    _count int;
  BEGIN
    select count(*)::int into _count
    from agent.workflow_run
    where workflow_key = _workflow_key
      and status = 'running';

    return _count;
  end;
  $$;

commit;
