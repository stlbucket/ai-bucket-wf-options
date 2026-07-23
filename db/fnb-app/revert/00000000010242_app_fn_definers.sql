-- Revert fnb:00000000010242_app_fn_definers from pg

begin;

drop function if exists app_api.set_workspace_membership(uuid, boolean) cascade;
drop function if exists app_fn.set_workspace_membership(uuid, uuid, boolean, uuid) cascade;
drop function if exists app_fn.remove_profile_from_tree_workspaces(uuid, uuid) cascade;
drop function if exists app_api.workspace_resident_pool() cascade;
drop function if exists app_fn.workspace_resident_pool(uuid) cascade;
drop function if exists app_fn.tenant_spine_ids(uuid) cascade;
drop function if exists app_fn.tenant_tree_ids(uuid) cascade;
drop function if exists app_fn.tenant_tree_root(uuid) cascade;
drop function if exists app_api.get_ab_listings(uuid) cascade;
drop function if exists app_fn.demo_profile_residencies() cascade;
drop function if exists app_api.demo_profile_residencies() cascade;
drop function if exists app_fn.invite_user(uuid, citext, app.license_type_assignment_scope) cascade;
drop function if exists app_fn.update_profile(uuid, citext, citext, citext, citext) cascade;
drop function if exists app_api.update_profile(citext, citext, citext, citext) cascade;
drop function if exists app_fn.decline_residency(uuid, citext) cascade;
drop function if exists app_api.decline_residency(uuid) cascade;
drop function if exists app_fn.assume_residency(uuid, citext) cascade;
drop function if exists app_api.assume_residency(uuid) cascade;
drop function if exists app_fn.handle_new_user() cascade;
drop function if exists app_fn.configure_user_metadata(uuid) cascade;

commit;
