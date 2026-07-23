-- Revert fnb:00000000010240_app_fn from pg

begin;

drop function if exists app_api.set_nested_tenant_type(uuid, app.tenant_type) cascade;
drop function if exists app_fn.set_nested_tenant_type(uuid, app.tenant_type) cascade;
drop function if exists app_api.throw_error(citext) cascade;
drop function if exists app_api.get_myself() cascade;
drop function if exists app_fn.leave_address_book(uuid) cascade;
drop function if exists app_api.leave_address_book() cascade;
drop function if exists app_fn.get_ab_listings(uuid, uuid) cascade;
drop function if exists app_api.get_ab_listings(uuid) cascade;
drop function if exists app_fn.join_address_book(uuid) cascade;
drop function if exists app_api.join_address_book() cascade;
drop function if exists app_fn.tenant_licenses(uuid) cascade;
drop function if exists app_api.tenant_licenses() cascade;
drop function if exists app_fn.tenant_profile_residencies(uuid) cascade;
drop function if exists app_api.tenant_profile_residencies() cascade;
drop function if exists app_fn.my_profile_residencies(text) cascade;
drop function if exists app_api.my_profile_residencies() cascade;
drop function if exists app_fn.unblock_resident(uuid) cascade;
drop function if exists app_api.unblock_resident(uuid) cascade;
drop function if exists app_fn.block_resident(uuid) cascade;
drop function if exists app_api.block_resident(uuid) cascade;
drop function if exists app_fn.revoke_user_license(uuid) cascade;
drop function if exists app_api.revoke_user_license(uuid) cascade;
drop function if exists app_fn.grant_user_license(uuid, citext, uuid) cascade;
drop function if exists app_api.grant_user_license(uuid, citext) cascade;
drop function if exists app_fn.subscribe_tenant_to_license_pack(uuid, citext) cascade;
drop function if exists app_api.subscribe_tenant_to_license_pack(uuid, citext) cascade;
drop function if exists app_fn.create_tenant(citext, citext, citext, app.tenant_type, app.license_type_assignment_scope) cascade;
drop function if exists app_api.create_tenant(citext, citext, citext, app.tenant_type) cascade;
drop function if exists app_fn.decline_invitation(uuid) cascade;
drop function if exists app_api.decline_invitation(uuid) cascade;
drop function if exists app_fn.available_modules(uuid) cascade;
drop function if exists app_api.available_modules() cascade;
drop function if exists app_fn.current_profile_claims(uuid) cascade;
drop function if exists app_api.current_profile_claims() cascade;
drop function if exists app_fn.create_anchor_tenant(citext, citext) cascade;
drop function if exists app_fn.install_anchor_application() cascade;
drop function if exists app_fn.install_basic_application(citext, citext, citext, boolean, app_fn.module_info[]) cascade;
drop function if exists app_fn.install_application(app_fn.application_info) cascade;

commit;
