-- n8n_api gate: workflow_runs() enforces p:app-admin-super (db/fnb-n8n/…011220_n8n_api.sql).
-- Spec: .claude/specs/db-testing/api-permission-tests.md.
\set t_a  '11111111-1111-1111-1111-111111111111'
\set prof '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(2);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');

-- (1) without p:app-admin-super, workflow_runs() raises (30000 → P0001)
select test._login(:'prof'::uuid, :'t_a'::uuid, array['p:app-user']);
select throws_ok(
  $$ select * from n8n_api.workflow_runs() $$,
  'P0001', null, 'n8n_api.workflow_runs without p:app-admin-super raises');

-- (2) grant shape: authenticated may EXECUTE the api fn
select function_privs_are('n8n_api', 'workflow_runs', array['citext', 'app_fn.paging_options'],
  'authenticated', array['EXECUTE'], 'authenticated may EXECUTE n8n_api.workflow_runs');

select * from finish();
rollback;
