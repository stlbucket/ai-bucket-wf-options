-- n8n.workflow_run RLS: view_runs_super_admin (FOR SELECT) — super-admins see their tenant's runs
-- AND the tenant-less (tenant_id IS NULL) runs. No write policy (writes via n8n_fn / n8n_worker).
-- This covers BOTH branches of the policy (the null-tenant path). Spec: rls-tests.md.
-- Filters are id-scoped (via format %L) because the dev DB may already hold real workflow runs.
\set t_a     '11111111-1111-1111-1111-111111111111'
\set r_ten   'a0000000-0000-0000-0000-0000000000a1'
\set r_null  'b0000000-0000-0000-0000-0000000000b2'
\set prof    '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(4);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
insert into n8n.workflow_run (id, workflow_key, tenant_id) values
  (:'r_ten'::uuid,  'exerciser',      :'t_a'::uuid),
  (:'r_null'::uuid, 'sync-breweries', null);

-- (1) RLS enabled
select is(
  (select relrowsecurity from pg_class where oid = 'n8n.workflow_run'::regclass),
  true, 'RLS enabled on n8n.workflow_run');

-- (2) super-admin sees BOTH the tenant-scoped run and the tenant-less run (both policy branches)
select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:app-admin-super']);
select set_eq(
  format($$ select workflow_key::text from n8n.workflow_run where id in (%L, %L) $$, :'r_ten', :'r_null'),
  array['exerciser', 'sync-breweries'],
  'super-admin sees tenant-scoped AND tenant-less runs');

-- (3) a non-super user sees neither
select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:app-user']);
select is_empty(
  format($$ select 1 from n8n.workflow_run where id in (%L, %L) $$, :'r_ten', :'r_null'),
  'non-super user sees no workflow runs');

-- (4) anon sees neither
select test._logout();
set local role anon;
select is_empty(
  format($$ select 1 from n8n.workflow_run where id in (%L, %L) $$, :'r_ten', :'r_null'),
  'anon sees no workflow runs');

select * from finish();
rollback;
