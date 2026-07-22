-- msg.topic RLS: view_all_for_tenant (FOR SELECT, jwt.has_permission('p:discussions', tenant_id))
-- + create_for_tenant (FOR INSERT, WITH CHECK same). NO update/delete policy → those are denied.
-- topic has no resident column, so seeding is just tenant + name. Spec: .claude/specs/db-testing/rls-tests.md.
\set t_a    '11111111-1111-1111-1111-111111111111'
\set t_b    '22222222-2222-2222-2222-222222222222'
\set top_a  'aa000000-0000-0000-0000-0000000000a1'
\set top_b  'bb000000-0000-0000-0000-0000000000b2'
\set prof_a '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(6);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_tenant(:'t_b'::uuid, 'tenant-b');
insert into msg.topic (id, tenant_id, name) values
  (:'top_a'::uuid, :'t_a'::uuid, 'topic-a'),
  (:'top_b'::uuid, :'t_b'::uuid, 'topic-b');

-- (1) RLS enabled
select is(
  (select relrowsecurity from pg_class where oid = 'msg.topic'::regclass),
  true, 'RLS enabled on msg.topic');

-- (2) user WITH p:discussions in tenant A sees only tenant A topics
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:discussions']);
select set_eq('select name::text from msg.topic', array['topic-a'],
  'p:discussions user sees only own-tenant topics');

-- (3) user WITHOUT p:discussions sees nothing (permission predicate, not just tenant)
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-user']);
select is_empty('select 1 from msg.topic', 'user without p:discussions sees no topics');

-- (4) p:discussions user may INSERT an own-tenant topic
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:discussions']);
select lives_ok(
  format($$ insert into msg.topic (id, tenant_id, name) values (gen_random_uuid(), %L, 'new') $$, :'t_a'),
  'p:discussions user can create an own-tenant topic');

-- (5) but not into another tenant (WITH CHECK)
select throws_ok(
  format($$ insert into msg.topic (id, tenant_id, name) values (gen_random_uuid(), %L, 'sneaky') $$, :'t_b'),
  '42501', null, 'cannot create a topic in another tenant');

-- (6) no UPDATE policy → update is a no-op (row not update-visible)
update msg.topic set name = 'hijack' where id = :'top_a'::uuid;   -- matches 0 rows
select test._logout();
select is((select name::text from msg.topic where id = :'top_a'::uuid), 'topic-a',
  'no UPDATE policy: topic name unchanged');

select * from finish();
rollback;
