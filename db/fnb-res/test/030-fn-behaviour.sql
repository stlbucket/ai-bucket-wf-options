-- res_fn behaviour: build_urn grammar, register_resource (idempotent, generated urn),
-- archive_resource (tombstone), uuid_generate_v7 (version nibble). Spec: fn-behaviour-tests.md.
\set t_a  '11111111-1111-1111-1111-111111111111'
\set rid  'a0000000-0000-0000-0000-00000000d001'

begin;
set search_path to tap, public;
select plan(6);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');

-- (1) build_urn grammar: urn:fnb:{tenant}:{module}:{type}:{id}
select is(
  res_fn.build_urn(:'t_a'::uuid, 'todo', 'todo', :'rid'::uuid),
  'urn:fnb:' || :'t_a' || ':todo:todo:' || :'rid',
  'build_urn follows urn:fnb:{tenant}:{module}:{type}:{id}');

-- (2) register_resource writes a row whose generated urn == build_urn
select res_fn.register_resource(:'rid'::uuid, :'t_a'::uuid, 'todo', 'todo');
select is(
  (select urn from res.resource where id = :'rid'::uuid),
  res_fn.build_urn(:'t_a'::uuid, 'todo', 'todo', :'rid'::uuid),
  'registered resource urn == build_urn');

-- (3) register_resource is idempotent (ON CONFLICT DO NOTHING)
select res_fn.register_resource(:'rid'::uuid, :'t_a'::uuid, 'todo', 'todo');
select is(
  (select count(*)::int from res.resource where id = :'rid'::uuid), 1,
  'register_resource is idempotent (no duplicate)');

-- (4) archive_resource sets the tombstone
select res_fn.archive_resource(:'rid'::uuid);
select is(
  (select archived_at is not null from res.resource where id = :'rid'::uuid), true,
  'archive_resource sets archived_at');

-- (5) uuid_generate_v7 stamps version 7 (the 13th hex digit / position 15 in text form)
select is(substring(res_fn.uuid_generate_v7()::text from 15 for 1), '7',
  'uuid_generate_v7 sets the version nibble to 7');

-- (6) build_urn is deterministic for the same inputs
select is(
  res_fn.build_urn(:'t_a'::uuid, 'msg', 'topic', :'rid'::uuid),
  res_fn.build_urn(:'t_a'::uuid, 'msg', 'topic', :'rid'::uuid),
  'build_urn is deterministic');

select * from finish();
rollback;
