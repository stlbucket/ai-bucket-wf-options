-- n8n_fn run-log lifecycle (Phase 3b, plan 0267; db/fnb-n8n/deploy/00000000011210_n8n_fn.sql).
-- The n8n_worker write surface: begin_run (first Postgres node) → complete_run / error_run /
-- error_run_by_execution (last node / shared error handler); running_count backs the singleton
-- guards. All SECURITY DEFINER, so we call them directly as the owner (no login needed). A unique
-- workflow_key isolates running_count from any real rows already in the dev DB.
\set wf 'pgtap-run-0267'

begin;
set search_path to tap, public;
select plan(13);

-- ── begin_run: inserts a 'running' row, returns its id ────────────────────────────────────────────
select n8n_fn.begin_run(:'wf'::citext, 'exec-1'::text, '{"a":1}'::jsonb, null::uuid) as r1 \gset
select is(
  (select status::text from n8n.workflow_run where id = :'r1'::uuid), 'running',
  'begin_run row starts in status running');
select is(
  (select workflow_key::text from n8n.workflow_run where id = :'r1'::uuid), :'wf',
  'begin_run stored the workflow_key');
select is(
  (select input_data from n8n.workflow_run where id = :'r1'::uuid), '{"a":1}'::jsonb,
  'begin_run stored input_data');
select is(
  n8n_fn.running_count(:'wf'::citext), 1,
  'running_count reflects the one in-flight run');

-- ── complete_run: flips to success, stamps finished_at + result_data ───────────────────────────────
select n8n_fn.complete_run(:'r1'::uuid, '{"ok":true}'::jsonb);
select is(
  (select status::text from n8n.workflow_run where id = :'r1'::uuid), 'success',
  'complete_run sets status success');
select is(
  (select finished_at is not null from n8n.workflow_run where id = :'r1'::uuid), true,
  'complete_run stamps finished_at');
select is(
  (select result_data from n8n.workflow_run where id = :'r1'::uuid), '{"ok":true}'::jsonb,
  'complete_run stored result_data');
select is(
  n8n_fn.running_count(:'wf'::citext), 0,
  'running_count drops to 0 once the run completes');

-- ── complete_run guard: unknown run id raises ──────────────────────────────────────────────────────
select throws_ok(
  $$ select n8n_fn.complete_run(gen_random_uuid(), '{}'::jsonb) $$,
  'P0001', null,
  'complete_run raises for an unknown run id');

-- ── error_run: flips a running row to error + stores the error payload ─────────────────────────────
select n8n_fn.begin_run(:'wf'::citext, 'exec-2'::text, '{}'::jsonb, null::uuid) as r2 \gset
select n8n_fn.error_run(:'r2'::uuid, '{"msg":"boom"}'::jsonb);
select is(
  (select status::text from n8n.workflow_run where id = :'r2'::uuid), 'error',
  'error_run sets status error');
select is(
  (select error from n8n.workflow_run where id = :'r2'::uuid), '{"msg":"boom"}'::jsonb,
  'error_run stored the error payload');

-- ── error_run_by_execution: flips the still-running row for an execution id ─────────────────────────
select n8n_fn.begin_run(:'wf'::citext, 'exec-3'::text, '{}'::jsonb, null::uuid) as r3 \gset
select n8n_fn.error_run_by_execution('exec-3'::text, '{"e":1}'::jsonb);
select is(
  (select status::text from n8n.workflow_run where id = :'r3'::uuid), 'error',
  'error_run_by_execution flips the running row matching the execution id');

-- ── error_run_by_execution no-op: no running row for the id is NOT an error (may fail pre-begin_run) ─
select lives_ok(
  $$ select n8n_fn.error_run_by_execution('no-such-exec-0267'::text, '{}'::jsonb) $$,
  'error_run_by_execution is a silent no-op when nothing is running for the id');

select * from finish();
rollback;
