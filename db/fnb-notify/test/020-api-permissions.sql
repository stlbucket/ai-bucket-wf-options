-- notify_api gate: notifications() enforces p:app-admin-super (db/fnb-notify/…011260_notify_api.sql).
\set t_a  '11111111-1111-1111-1111-111111111111'
\set prof '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(2);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');

-- (1) without p:app-admin-super, notifications() raises (30000 → P0001)
select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:app-user']);
select throws_ok(
  $$ select * from notify_api.notifications() $$,
  'P0001', null, 'notify_api.notifications without p:app-admin-super raises');

-- (2) grant shape: authenticated may EXECUTE the api fn
select function_privs_are('notify_api', 'notifications',
  array['notify.notification_channel', 'app_fn.paging_options'],
  'authenticated', array['EXECUTE'], 'authenticated may EXECUTE notify_api.notifications');

select * from finish();
rollback;
