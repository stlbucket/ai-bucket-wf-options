-- Behaviour of todo_fn.* (db/fnb-todo/deploy/00000000010470_todo_fn.sql).
-- Spec: .claude/specs/db-testing/fn-behaviour-tests.md. Run as authenticated with a valid
-- tenant+resident; every assertion is inside one BEGIN…ROLLBACK, so all rows + res.resource
-- registrations vanish.
\set t_a    '11111111-1111-1111-1111-111111111111'
\set res_a  '55555555-5555-5555-5555-555555555555'
\set prof_a '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(16);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_resident(:'res_a'::uuid, :'t_a'::uuid);
select urn as res_a_urn from app.resident where id = :'res_a'::uuid \gset
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:todo','p:app-user'], :'res_a'::uuid);

-- create a root todo (side effects: ordinal, root_todo_id, generated urn, res.resource row)
select todo_fn.create_todo('root task',
  row(null,null,'{}'::citext[],false)::todo_fn.create_todo_options, :'res_a'::uuid);

-- (1) root todo gets ordinal 0
select is((select ordinal from todo.todo where name = 'root task'), 0,
  'root todo has ordinal 0');
-- (2) a root is its own root
select is((select (root_todo_id = id) from todo.todo where name = 'root task'), true,
  'root todo is its own root_todo_id');
-- (3) the generated urn is populated (res_fn.build_urn)
select isnt((select urn from todo.todo where name = 'root task'), null,
  'create_todo generated a urn');

-- (4) create_todo registered a res.resource row — read as OWNER (res.resource is deny-all under RLS)
select test._logout();
select is(
  (select count(*)::int from res.resource r
     join todo.todo t on t.id = r.id where t.name = 'root task'),
  1, 'create_todo registered exactly one res.resource row');
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:todo','p:app-user'], :'res_a'::uuid);

-- (5) name guard: < 3 chars raises 30028 (SQLSTATE P0001). The guard is create_todo's first
--     statement, so the resident arg is never read → a throwaway uuid is fine (and psql does NOT
--     interpolate :vars inside $$…$$, so we must not embed one here).
select throws_ok(
  $$ select todo_fn.create_todo('ab',
       row(null,null,'{}'::citext[],false)::todo_fn.create_todo_options, gen_random_uuid()) $$,
  'P0001', null,
  'create_todo rejects a name shorter than 3 chars');

-- (6) status cascade: completing the only child completes the parent
select todo_fn.create_todo('parent task',
  row(null,null,'{}'::citext[],false)::todo_fn.create_todo_options, :'res_a'::uuid);
select todo_fn.create_todo('child task',
  row(null,(select id from todo.todo where name = 'parent task'),'{}'::citext[],false)
    ::todo_fn.create_todo_options,
  :'res_a'::uuid);
select todo_fn.update_todo_status(
  (select id from todo.todo where name = 'child task'), 'complete');
select is(
  (select status::text from todo.todo where name = 'parent task'),
  'complete', 'completing the only child completes the parent');

-- (7) template guard: update_todo_status on a template raises 30029 (SQLSTATE P0001)
select todo_fn.create_todo('tmpl task',
  row(null,null,'{}'::citext[],true)::todo_fn.create_todo_options, :'res_a'::uuid);
select throws_ok(
  $$ select todo_fn.update_todo_status(
       (select id from todo.todo where name = 'tmpl task'), 'complete') $$,
  'P0001', null,
  'update_todo_status on a template todo raises');

-- ── multi-assignee behaviour (todo_fn.add/remove_todo_assignee, cascade, copy, search) ──

-- (8) create_todo writes no assignee row (every create above left the table empty)
select is((select count(*)::int from todo.todo_assignee), 0,
  'create_todo writes no assignee row (todos start unassigned)');

-- (9) add is idempotent: re-adding the same assignee keeps exactly one row
select todo_fn.add_todo_assignee(
  (select id from todo.todo where name = 'root task'), :'res_a_urn', :'res_a'::uuid);
select todo_fn.add_todo_assignee(
  (select id from todo.todo where name = 'root task'), :'res_a_urn', :'res_a'::uuid);
select is(
  (select count(*)::int from todo.todo_assignee where resident_urn = :'res_a_urn'),
  1, 'add_todo_assignee is idempotent (re-add keeps one row)');

-- (10) provenance: assigned_by_resident_urn = the acting resident's urn
select is(
  (select assigned_by_resident_urn::text from todo.todo_assignee limit 1),
  :'res_a_urn', 'add_todo_assignee records the actor as assigned_by_resident_urn');

-- (11) template guard: assigning a template raises 30031 (SQLSTATE P0001).
--      Guard fires before the actor lookup/insert, so junk urn+resident never get read.
select throws_ok(
  $$ select todo_fn.add_todo_assignee(
       (select id from todo.todo where name = 'tmpl task'), 'urn:junk', gen_random_uuid()) $$,
  'P0001', null,
  'add_todo_assignee on a template todo raises');

-- (12) search filter: assigned_to_resident_urn matches only assigned todos
--      (options attribute order: search_term, type, status, roots_only, is_template,
--       paging_options, assigned_to_resident_urn)
select set_eq(
  format($$ select name::text from todo_fn.search_todos(
    row(null,null,null,null,null,null,%L)::todo_fn.search_todos_options) $$, :'res_a_urn'),
  array['root task'],
  'search_todos assigned_to_resident_urn filter matches only assigned todos');

-- (13)+(14) remove returns true and is idempotent (absent assignee → still true, no raise)
select is(
  todo_fn.remove_todo_assignee(
    (select id from todo.todo where name = 'root task'), :'res_a_urn'),
  true, 'remove_todo_assignee returns true');
select is(
  todo_fn.remove_todo_assignee(
    (select id from todo.todo where name = 'root task'), :'res_a_urn'),
  true, 'remove_todo_assignee is idempotent (absent assignee is a no-op)');

-- (15) delete_todo cascades assignee rows (child assigned, parent deleted recursively)
select todo_fn.add_todo_assignee(
  (select id from todo.todo where name = 'child task'), :'res_a_urn', :'res_a'::uuid);
select todo_fn.delete_todo((select id from todo.todo where name = 'parent task'));
select is((select count(*)::int from todo.todo_assignee), 0,
  'delete_todo cascades assignee rows');

-- (16) deep_copy_todo output carries no assignees
select todo_fn.add_todo_assignee(
  (select id from todo.todo where name = 'root task'), :'res_a_urn', :'res_a'::uuid);
select id as copy_id from todo_fn.deep_copy_todo(
  :'res_a'::uuid, (select id from todo.todo where name = 'root task'), false) \gset
select is(
  (select count(*)::int from todo.todo_assignee where todo_id = :'copy_id'::uuid),
  0, 'deep_copy_todo output has zero assignees');

select * from finish();
rollback;
