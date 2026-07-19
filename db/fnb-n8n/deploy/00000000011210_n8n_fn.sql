-- Deploy fnb-n8n:00000000011210_n8n_fn to pg

begin;

create schema n8n_fn;

-- Run-log writes for the n8n engine. Called over the n8n_worker connection from inside n8n
-- workflows: begin_run is the first Postgres node of every fnb-triggered workflow,
-- complete_run the last, and error_run_by_execution is called by the shared error-handler
-- workflow (the n8n analog of the agent harness catch-all).

---------------------------------------------- begin_run -- first Postgres node of a workflow
CREATE OR REPLACE FUNCTION n8n_fn.begin_run(
    _workflow_key citext
    ,_n8n_execution_id text default null
    ,_input_data jsonb default '{}'::jsonb
    ,_tenant_id uuid default null
  )
  RETURNS uuid
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _run_id uuid;
  BEGIN
    insert into n8n.workflow_run(workflow_key, n8n_execution_id, input_data, tenant_id)
    values (_workflow_key, _n8n_execution_id, coalesce(_input_data, '{}'::jsonb), _tenant_id)
    returning id into _run_id;

    return _run_id;
  end;
  $$;

---------------------------------------------- complete_run -- last node of a workflow
CREATE OR REPLACE FUNCTION n8n_fn.complete_run(
    _run_id uuid
    ,_result_data jsonb default '{}'::jsonb
  )
  RETURNS n8n.workflow_run
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _run n8n.workflow_run;
  BEGIN
    update n8n.workflow_run set
      status = 'success'
      ,result_data = coalesce(_result_data, '{}'::jsonb)
      ,finished_at = current_timestamp
    where id = _run_id
    returning * into _run;

    if _run.id is null then
      raise exception 'workflow run not found: %', _run_id;
    end if;

    return _run;
  end;
  $$;

---------------------------------------------- error_run -- error-handler, when the run id is known
CREATE OR REPLACE FUNCTION n8n_fn.error_run(
    _run_id uuid
    ,_error jsonb
  )
  RETURNS n8n.workflow_run
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _run n8n.workflow_run;
  BEGIN
    update n8n.workflow_run set
      status = 'error'
      ,error = coalesce(_error, '{}'::jsonb)
      ,finished_at = current_timestamp
    where id = _run_id
    returning * into _run;

    if _run.id is null then
      raise exception 'workflow run not found: %', _run_id;
    end if;

    return _run;
  end;
  $$;

---------------------------------------------- error_run_by_execution -- the shared error-handler
-- workflow (only the failed execution's id is known there). Flips the still-running row for
-- that execution; a no-op result is not an error (the run may have failed before begin_run).
CREATE OR REPLACE FUNCTION n8n_fn.error_run_by_execution(
    _n8n_execution_id text
    ,_error jsonb
  )
  RETURNS n8n.workflow_run
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _run n8n.workflow_run;
  BEGIN
    update n8n.workflow_run set
      status = 'error'
      ,error = coalesce(_error, '{}'::jsonb)
      ,finished_at = current_timestamp
    where n8n_execution_id = _n8n_execution_id
      and status = 'running'
    returning * into _run;

    return _run;
  end;
  $$;

---------------------------------------------- running_count -- future singleton guards /
-- status fns (parity with agent_fn.running_count)
CREATE OR REPLACE FUNCTION n8n_fn.running_count(_workflow_key citext)
  RETURNS int
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $$
  DECLARE
    _count int;
  BEGIN
    select count(*)::int into _count
    from n8n.workflow_run
    where workflow_key = _workflow_key
      and status = 'running';

    return _count;
  end;
  $$;

---------------------------------------------- dataset_sync_busy -- cross-engine dataset guard
-- for the n8n dataset-sync twins (n8n-parallel-engine/dataset-sync.workflow.data.md): the
-- first Postgres node of a twin checks both engines before begin_run. Lives here as SECURITY
-- DEFINER instead of granting n8n_worker usage on agent_fn — schema USAGE is what keeps the
-- PUBLIC-executable _fn surfaces closed, so it must not widen.
CREATE OR REPLACE FUNCTION n8n_fn.dataset_sync_busy(
    _agent_workflow_key citext
    ,_n8n_workflow_key citext
  )
  RETURNS int
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $$
  BEGIN
    return agent_fn.running_count(_agent_workflow_key) + n8n_fn.running_count(_n8n_workflow_key);
  end;
  $$;

commit;
