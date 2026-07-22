-- Behaviour of todo_fn.* (db/fnb-todo/deploy/00000000010470_todo_fn.sql).
-- Spec: .claude/specs/db-testing/fn-behaviour-tests.md. Run as authenticated with a valid
-- tenant+resident; every assertion is inside one BEGIN…ROLLBACK, so all rows + res.resource
-- registrations vanish.
\set t_a    '11111111-1111-1111-1111-111111111111'
\set res_a  '55555555-5555-5555-5555-555555555555'
\set prof_a '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(7);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_resident(:'res_a'::uuid, :'t_a'::uuid);
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

select * from finish();
rollback;
