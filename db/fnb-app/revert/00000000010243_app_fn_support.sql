-- Revert fnb:00000000010243_app_fn_support from pg

begin;

drop function if exists app_api.site_user_by_id(uuid) cascade;
drop function if exists app_fn.search_tenants(app_fn.search_tenants_options) cascade;
drop function if exists app_api.search_tenants(app_fn.search_tenants_options) cascade;
drop function if exists app_fn.search_profiles(app_fn.search_profiles_options) cascade;
drop function if exists app_api.search_profiles(app_fn.search_profiles_options) cascade;
drop function if exists app_fn.search_residents(app_fn.search_residents_options) cascade;
drop function if exists app_api.search_residents(app_fn.search_residents_options) cascade;
drop function if exists app_fn.reactivate_tenant_subscription(uuid) cascade;
drop function if exists app_api.reactivate_tenant_subscription(uuid) cascade;
drop function if exists app_fn.deactivate_tenant_subscription(uuid) cascade;
drop function if exists app_api.deactivate_tenant_subscription(uuid) cascade;
drop function if exists app_fn.activate_tenant(uuid) cascade;
drop function if exists app_api.activate_tenant(uuid) cascade;
drop function if exists app_fn.deactivate_tenant(uuid) cascade;
drop function if exists app_api.deactivate_tenant(uuid) cascade;
drop function if exists app_fn.exit_support_mode(uuid, uuid) cascade;
drop function if exists app_api.exit_support_mode() cascade;
drop function if exists app_fn.become_support(uuid, uuid) cascade;
drop function if exists app_api.become_support(uuid) cascade;

commit;
