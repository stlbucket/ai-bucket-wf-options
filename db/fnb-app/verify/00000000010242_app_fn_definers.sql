-- Verify fnb:00000000010242_app_fn_definers on pg

begin;

select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'handle_new_user';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'assume_residency';
-- U10: assert the extended 7-arg signature (uuid, citext, assignment_scope, citext×4) exists.
-- pg_get_function_identity_arguments returns arg TYPES only (no names/defaults).
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_fn' and p.proname = 'invite_user'
    and pg_get_function_identity_arguments(p.oid) =
      'uuid, citext, app.license_type_assignment_scope, citext, citext, citext, citext';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_api' and p.proname = 'update_profile';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_api' and p.proname = 'assume_residency';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_api' and p.proname = 'workspace_resident_pool';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_api' and p.proname = 'set_workspace_membership';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'remove_profile_from_tree_workspaces';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'tenant_spine_ids';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'tenant_subtree_residents';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_api' and p.proname = 'tenant_subtree_residents';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_fn' and p.proname = 'subtree_resident_detail';
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_api' and p.proname = 'subtree_resident_detail';

rollback;
