-- Permission gate + grant shape on todo_api (db/fnb-todo/deploy/00000000010470_todo_fn.sql,
-- ..010480_todo_policies.sql). Spec: .claude/specs/db-testing/api-permission-tests.md.
--
-- KNOWN GAPS this suite documents (asserted as CURRENT reality, not the idealized model):
--   * Only todo_api.create_todo gates on jwt.has_permission('p:todo'); update/delete/pin/… are
--     ungated (they delegate straight to todo_fn).
--   * todo_fn is broadly granted (all routines → anon, authenticated, service_role) and all fns are
--     SECURITY INVOKER — the _fn/_api split is organizational, NOT a privilege boundary.
-- Flip these to the stricter form when a hardening pass tightens the api layer.
\set t_a    '11111111-1111-1111-1111-111111111111'
\set res_a  '55555555-5555-5555-5555-555555555555'
\set prof_a '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(5);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_resident(:'res_a'::uuid, :'t_a'::uuid);

-- (1) gate: WITHOUT p:todo, create_todo raises PERMISSION DENIED (30000 → SQLSTATE P0001).
--     The check is create_todo's first statement, so no valid resident/side effect is needed.
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array[]::text[], :'res_a'::uuid);
select throws_ok(
  $$ select todo_api.create_todo('buy milk',
       row(null,null,'{}'::citext[],false)::todo_fn.create_todo_options) $$,
  'P0001', null,
  'create_todo without p:todo raises PERMISSION DENIED');

-- (2) gate: WITH p:todo (+ p:app-user for the app.resident read), create_todo succeeds
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:todo','p:app-user'], :'res_a'::uuid);
select lives_ok(
  $$ select todo_api.create_todo('buy milk',
       row(null,null,'{}'::citext[],false)::todo_fn.create_todo_options) $$,
  'create_todo with p:todo succeeds');

-- (3) GAP: update_todo exists but is ungated (documented; no permission assertion possible)
select has_function(
  'todo_api', 'update_todo', array['uuid','citext','citext'],
  'todo_api.update_todo exists (NOTE: currently ungated — no p:todo required)');

-- (4) grant shape: authenticated may EXECUTE the api fn (reality pin)
select function_privs_are(
  'todo_api', 'create_todo', array['citext','todo_fn.create_todo_options'],
  'authenticated', array['EXECUTE'],
  'authenticated may EXECUTE todo_api.create_todo');

-- (5) GAP: the _fn layer is broadly granted too — anon can EXECUTE it directly
select function_privs_are(
  'todo_fn', 'create_todo', array['citext','todo_fn.create_todo_options','uuid'],
  'anon', array['EXECUTE'],
  'GAP: anon can EXECUTE todo_fn.create_todo directly (broad grant, not a privilege boundary)');

select * from finish();
rollback;
