-- msg_fn.upsert_topic behaviour: creates a topic (generated urn + res.resource registration),
-- creates the initial message, upserts by identifier (no duplicate), and rejects a bad resident.
-- Spec: .claude/specs/db-testing/fn-behaviour-tests.md. Run as owner (resident_id passed explicitly).
\set t_a   '11111111-1111-1111-1111-111111111111'
\set res_a '55555555-5555-5555-5555-555555555555'

begin;
set search_path to tap, public;
select plan(6);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_resident(:'res_a'::uuid, :'t_a'::uuid);

select msg_fn.upsert_topic(
  row(null::uuid, 'topic-x'::citext, 'tid-1'::text, 'open'::msg.topic_status,
      null::msg_fn.subscriber_info[], 'hello'::citext, null::text)::msg_fn.topic_info,
  :'res_a'::uuid);

-- (1) topic created
select is((select count(*)::int from msg.topic where identifier = 'tid-1'), 1,
  'upsert_topic created the topic');
-- (2) generated urn present
select isnt((select urn from msg.topic where identifier = 'tid-1'), null,
  'topic has a generated urn');
-- (3) registered in res.resource as module msg
select is(
  (select count(*)::int from res.resource r join msg.topic t on t.id = r.id
     where t.identifier = 'tid-1' and r.module = 'msg'), 1,
  'upsert_topic registered a res.resource (module msg)');
-- (4) the initial_message became a message row
select is(
  (select count(*)::int from msg.message m join msg.topic t on t.id = m.topic_id
     where t.identifier = 'tid-1'), 1,
  'initial_message created one message');

-- (5) upsert by identifier is not a duplicate insert
select msg_fn.upsert_topic(
  row(null::uuid, 'topic-x2'::citext, 'tid-1'::text, 'open'::msg.topic_status,
      null::msg_fn.subscriber_info[], null::citext, null::text)::msg_fn.topic_info,
  :'res_a'::uuid);
select is((select count(*)::int from msg.topic where identifier = 'tid-1'), 1,
  'upsert on the same identifier does not create a duplicate');

-- (6) a bad resident id is rejected
select throws_ok(
  $$ select msg_fn.upsert_topic(
       row(null::uuid, 't'::citext, null::text, 'open'::msg.topic_status,
           null::msg_fn.subscriber_info[], null::citext, null::text)::msg_fn.topic_info,
       gen_random_uuid()) $$,
  'P0001', null, 'upsert_topic rejects a non-existent resident');

select * from finish();
rollback;
