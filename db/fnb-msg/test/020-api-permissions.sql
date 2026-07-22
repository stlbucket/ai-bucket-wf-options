-- msg_api permission gate (db/fnb-msg/deploy/00000000010410_msg_fn.sql): upsert_topic /
-- upsert_message / upsert_subscriber / deactivate_subscriber all enforce_permission('p:discussions').
-- Spec: .claude/specs/db-testing/api-permission-tests.md. GAP: msg_fn is broadly granted (house
-- default) — the split is organizational, not a privilege boundary.
\set t_a    '11111111-1111-1111-1111-111111111111'
\set prof_a '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(3);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');

-- (1) upsert_topic without p:discussions raises (30000 → P0001); the gate is the first statement
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array[]::text[]);
select throws_ok(
  $$ select msg_api.upsert_topic(
       row(null::uuid, 'x'::citext, null::text, 'open'::msg.topic_status,
           null::msg_fn.subscriber_info[], null::citext, null::text)::msg_fn.topic_info) $$,
  'P0001', null, 'upsert_topic without p:discussions raises PERMISSION DENIED');

-- (2) grant shape: authenticated may EXECUTE the api fn
select function_privs_are('msg_api', 'upsert_topic', array['msg_fn.topic_info'],
  'authenticated', array['EXECUTE'], 'authenticated may EXECUTE msg_api.upsert_topic');

-- (3) GAP: msg_fn is broadly granted — anon can EXECUTE it directly
select function_privs_are('msg_fn', 'upsert_topic', array['msg_fn.topic_info', 'uuid'],
  'anon', array['EXECUTE'],
  'GAP: anon can EXECUTE msg_fn.upsert_topic directly (broad grant)');

select * from finish();
rollback;
