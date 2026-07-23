-- fnb-app RLS (part 5, plan 0267): app.support_ticket_comment — the last uncovered RLS table.
-- Policies (…010250_app_policies.sql:160-177): manage_own_comments (resident_id = jwt.resident_id());
-- view_ticket_comments (EXISTS the parent ticket AND the caller is the ticket's resident, a tenant
-- admin, or support staff); manage_all_support_comments (support staff). Self-seeds the same
-- tenant_subscription → ticket → comment chain as 012.
\set t_a     '11111111-1111-1111-1111-111111111111'
\set prof_a1 '33333333-3333-3333-3333-333333333333'
\set prof_a2 '44444444-4444-4444-4444-444444444444'
\set res_a1  'a0000000-0000-0000-0000-0000000000a1'
\set res_a2  'a0000000-0000-0000-0000-0000000000a2'
\set sub_a   'c0000000-0000-0000-0000-0000000000c1'
\set tik_a1  'e0000000-0000-0000-0000-0000000000e1'
\set com_a1  'f0000000-0000-0000-0000-0000000000f1'

begin;
set search_path to tap, public;
select plan(5);

-- seed chain (as owner): tenant → profiles → residents → app/type/pack → subscription → ticket → comment
select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
insert into app.profile (id, email) values
  (:'prof_a1'::uuid, 'a1@test.local'), (:'prof_a2'::uuid, 'a2@test.local');
insert into app.resident (id, profile_id, tenant_id, tenant_name, email, display_name, type, status) values
  (:'res_a1'::uuid, :'prof_a1'::uuid, :'t_a'::uuid, 'tenant-a', 'a1@test.local', 'Res A1', 'home', 'active'),
  (:'res_a2'::uuid, :'prof_a2'::uuid, :'t_a'::uuid, 'tenant-a', 'a2@test.local', 'Res A2', 'home', 'active');
insert into app.application (key, name) values ('test-app', 'Test App');
insert into app.license_type (key, application_key, display_name, assignment_scope)
  values ('test-lt', 'test-app', 'Test LT', 'user');
insert into app.license_pack (key, display_name, description) values ('test-pack', 'Test Pack', 'desc');
insert into app.tenant_subscription (id, tenant_id, license_pack_key) values (:'sub_a'::uuid, :'t_a'::uuid, 'test-pack');
insert into app.support_ticket (id, tenant_id, tenant_subscription_id, resident_id, title, description)
  values (:'tik_a1'::uuid, :'t_a'::uuid, :'sub_a'::uuid, :'res_a1'::uuid, 'Help', 'please');
insert into app.support_ticket_comment (id, support_ticket_id, resident_id, body)
  values (:'com_a1'::uuid, :'tik_a1'::uuid, :'res_a1'::uuid, 'a comment');

-- (1) RLS enabled on the table
select is((select relrowsecurity from pg_class where oid = 'app.support_ticket_comment'::regclass), true,
  'RLS enabled on app.support_ticket_comment');

-- (2) the comment's own resident (also the ticket owner) sees it
select test._login(:'prof_a1'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a1'::uuid);
select is((select count(*)::int from app.support_ticket_comment where id = :'com_a1'::uuid), 1,
  'the commenting resident sees their own comment');

-- (3) an unrelated resident in the same tenant (not owner, not admin) does NOT see it
select test._login(:'prof_a2'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a2'::uuid);
select is_empty(format($$ select 1 from app.support_ticket_comment where id = %L $$, :'com_a1'),
  'an unrelated same-tenant resident cannot see the comment');

-- (4) a tenant admin sees it (view_ticket_comments EXISTS → p:app-admin branch)
select test._login(:'prof_a2'::uuid, :'t_a'::uuid, array['p:app-admin'], :'res_a2'::uuid);
select is((select count(*)::int from app.support_ticket_comment where id = :'com_a1'::uuid), 1,
  'a tenant admin sees comments on the tenant''s ticket');

-- (5) support staff sees it (manage_all_support_comments)
select test._login(:'prof_a2'::uuid, :'t_a'::uuid, array['p:app-admin-support'], :'res_a2'::uuid);
select is((select count(*)::int from app.support_ticket_comment where id = :'com_a1'::uuid), 1,
  'support staff sees the comment');

select * from finish();
rollback;
