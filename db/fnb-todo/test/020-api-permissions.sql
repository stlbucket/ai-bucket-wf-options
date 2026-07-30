-- Permission gate + grant shape on todo_api (db/fnb-todo/deploy/00000000010470_todo_fn.sql,
-- ..010480_todo_policies.sql). Spec: docs/specs/db-testing/api-permission-tests.md.
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
select plan(9);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_resident(:'res_a'::uuid, :'t_a'::uuid);
select urn as res_a_urn from app.resident where id = :'res_a'::uuid \gset

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

-- ── multi-assignee gates (add/remove_todo_assignee check p:todo like create_todo) ──

-- (6)+(7) gate: WITHOUT p:todo both raise PERMISSION DENIED (30000 → SQLSTATE P0001).
--     The gate is each fn's first statement, so junk args never get read.
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array[]::text[], :'res_a'::uuid);
select throws_ok(
  $$ select todo_api.add_todo_assignee(gen_random_uuid(), 'urn:junk') $$,
  'P0001', null,
  'add_todo_assignee without p:todo raises PERMISSION DENIED');
select throws_ok(
  $$ select todo_api.remove_todo_assignee(gen_random_uuid(), 'urn:junk') $$,
  'P0001', null,
  'remove_todo_assignee without p:todo raises PERMISSION DENIED');

-- (8)+(9) gate: WITH p:todo both succeed against the todo created in (2)
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:todo','p:app-user'], :'res_a'::uuid);
select lives_ok(
  format($$ select todo_api.add_todo_assignee(
    (select id from todo.todo where name = 'buy milk' limit 1), %L) $$, :'res_a_urn'),
  'add_todo_assignee with p:todo succeeds');
select lives_ok(
  format($$ select todo_api.remove_todo_assignee(
    (select id from todo.todo where name = 'buy milk' limit 1), %L) $$, :'res_a_urn'),
  'remove_todo_assignee with p:todo succeeds');

select * from finish();
rollback;
