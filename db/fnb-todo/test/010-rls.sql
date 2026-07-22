-- RLS, direct on todo.todo — the tenant-only `manage_all_for_tenant` policy
-- (db/fnb-todo/deploy/00000000010480_todo_policies.sql). Spec: .claude/specs/db-testing/rls-tests.md.
-- NOTE the policy is TENANT-ONLY: no permission predicate, no super-admin bypass. Cross-tenant
-- writes fail WITH CHECK (42501); cross-tenant reads/updates are silent no-ops.
\set t_a      '11111111-1111-1111-1111-111111111111'
\set t_b      '22222222-2222-2222-2222-222222222222'
\set td_a     'aa111111-1111-1111-1111-111111111111'
\set td_b     'bb222222-2222-2222-2222-222222222222'
\set prof_a   '33333333-3333-3333-3333-333333333333'
\set prof_adm '44444444-4444-4444-4444-444444444444'

begin;
set search_path to tap, public;
select plan(7);

-- seed as owner (postgres bypasses RLS)
select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_tenant(:'t_b'::uuid, 'tenant-b');
insert into todo.todo (id, tenant_id, root_todo_id, name, ordinal) values
  (:'td_a'::uuid, :'t_a'::uuid, :'td_a'::uuid, 'a-todo', 0),
  (:'td_b'::uuid, :'t_b'::uuid, :'td_b'::uuid, 'b-todo', 0);

-- (1) RLS is actually enabled on the table
select is(
  (select relrowsecurity from pg_class where oid = 'todo.todo'::regclass),
  true, 'RLS is enabled on todo.todo');

-- become tenant A
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:todo']);

-- (2) tenant A sees only its own row
select set_eq(
  'select name::text from todo.todo',
  array['a-todo'],
  'tenant A sees only tenant A todos');

-- (3) other tenants invisible even by explicit filter
select is_empty(
  $$ select 1 from todo.todo where tenant_id <> jwt.tenant_id()::uuid $$,
  'tenant A cannot see other-tenant rows even by explicit filter');

-- (4) cross-tenant INSERT denied by WITH CHECK
select throws_ok(
  format($$ insert into todo.todo (id, tenant_id, root_todo_id, name, ordinal)
            values (gen_random_uuid(), %L, gen_random_uuid(), 'sneaky', 0) $$, :'t_b'),
  '42501', null,
  'tenant A cannot INSERT a tenant B row (WITH CHECK)');

-- (5) cross-tenant UPDATE is a silent no-op: the row is invisible to tenant A, so the UPDATE
--     matches zero rows and does not raise. Verify by reading the row back as the owner — its
--     name is unchanged. (A data-modifying CTE cannot be nested inside is(), so run it plainly.)
update todo.todo set name = 'hijack' where id = :'td_b'::uuid;   -- as tenant A: matches 0 rows
select test._logout();                                           -- owner: RLS bypassed
select is(
  (select name::text from todo.todo where id = :'td_b'::uuid),
  'b-todo', 'tenant A UPDATE did not modify the tenant B row');

-- (6) super-admin does NOT bypass this tenant-only policy
select test._login(:'prof_adm'::uuid, :'t_a'::uuid, array['p:app-admin-super']);
select set_eq(
  'select name::text from todo.todo',
  array['a-todo'],
  'p:app-admin-super still sees only its own tenant (policy is tenant-only)');

-- (7) anon (no claims) sees nothing
select test._logout();
set local role anon;
select is_empty('select 1 from todo.todo', 'anon sees no rows');

select * from finish();
rollback;
