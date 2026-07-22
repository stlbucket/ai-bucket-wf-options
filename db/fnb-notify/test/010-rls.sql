-- notify.notification RLS: view_notifications_super_admin (FOR SELECT) — super-admins see their
-- tenant's notifications AND the tenant-less (tenant_id IS NULL) rows. No write policy (writes via
-- notify_fn / n8n_worker). Covers BOTH branches of the policy (the null-tenant path).
-- Filters are id-scoped (via format %L) because the dev DB may already hold real notifications.
\set t_a     '11111111-1111-1111-1111-111111111111'
\set n_ten   'a0000000-0000-0000-0000-0000000000c1'
\set n_null  'b0000000-0000-0000-0000-0000000000c2'
\set prof    '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(4);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
insert into notify.notification (id, channel, template_key, recipient, tenant_id) values
  (:'n_ten'::uuid,  'email', 'test', 'a@example.com', :'t_a'::uuid),
  (:'n_null'::uuid, 'email', 'test', 'b@example.com', null);

-- (1) RLS enabled
select is(
  (select relrowsecurity from pg_class where oid = 'notify.notification'::regclass),
  true, 'RLS enabled on notify.notification');

-- (2) super-admin sees BOTH the tenant-scoped row and the tenant-less row (both policy branches)
select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:app-admin-super']);
select set_eq(
  format($$ select recipient::text from notify.notification where id in (%L, %L) $$, :'n_ten', :'n_null'),
  array['a@example.com', 'b@example.com'],
  'super-admin sees tenant-scoped AND tenant-less notifications');

-- (3) a non-super user sees neither
select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:app-user']);
select is_empty(
  format($$ select 1 from notify.notification where id in (%L, %L) $$, :'n_ten', :'n_null'),
  'non-super user sees no notifications');

-- (4) anon sees neither
select test._logout();
set local role anon;
select is_empty(
  format($$ select 1 from notify.notification where id in (%L, %L) $$, :'n_ten', :'n_null'),
  'anon sees no notifications');

select * from finish();
rollback;
