-- res.resource RLS: resource_select — a registry row is visible if the caller is super-admin, OR
-- the row's module maps (res.module_permission) to a permission the caller holds for the row's
-- tenant, OR (null-key module) the caller is a member of the row's tenant. Seeded module map:
-- todo→p:todo, loc→NULL. Spec: .claude/specs/db-testing/rls-tests.md.
\set t_a    '11111111-1111-1111-1111-111111111111'
\set t_b    '22222222-2222-2222-2222-222222222222'
\set r_todo 'a0000000-0000-0000-0000-00000000a001'
\set r_loc  'a0000000-0000-0000-0000-00000000a002'
\set r_btod 'b0000000-0000-0000-0000-00000000b001'
\set prof   '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(4);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_tenant(:'t_b'::uuid, 'tenant-b');
-- register three resources (SECURITY DEFINER writes the deny-all registry)
select res_fn.register_resource(:'r_todo'::uuid, :'t_a'::uuid, 'todo', 'todo');   -- key: p:todo
select res_fn.register_resource(:'r_loc'::uuid,  :'t_a'::uuid, 'loc',  'location'); -- key: NULL
select res_fn.register_resource(:'r_btod'::uuid, :'t_b'::uuid, 'todo', 'todo');   -- other tenant

-- (1) RLS enabled
select is(
  (select relrowsecurity from pg_class where oid = 'res.resource'::regclass),
  true, 'RLS enabled on res.resource');

-- (2) tenant A user with p:todo sees the p:todo resource + the null-key (loc) resource, NOT tenant B's
select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:todo', 'p:app-user']);
select set_eq(
  format($$ select module::text from res.resource where id in (%L, %L, %L) $$,
         :'r_todo', :'r_loc', :'r_btod'),
  array['todo', 'loc'],
  'tenant A + p:todo sees own todo + null-key loc, not tenant B');

-- (3) super-admin sees all three
select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:app-admin-super']);
select is(
  (select count(*)::int from res.resource
     where id in (:'r_todo'::uuid, :'r_loc'::uuid, :'r_btod'::uuid)),
  3, 'super-admin sees all registered resources');

-- (4) tenant A user WITHOUT p:todo sees only the null-key (loc) resource
select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:app-user']);
select set_eq(
  format($$ select module::text from res.resource where id in (%L, %L, %L) $$,
         :'r_todo', :'r_loc', :'r_btod'),
  array['loc'],
  'without p:todo, only the null-key (tenant-membership) resource is visible');

select * from finish();
rollback;
