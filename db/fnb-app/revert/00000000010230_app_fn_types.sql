-- Revert fnb:00000000010230_app_fn_types from pg

begin;

drop schema if exists app_api cascade;

drop type if exists app_fn.search_tenants_options cascade;
drop type if exists app_fn.search_profiles_options cascade;
drop type if exists app_fn.search_residents_options cascade;
drop type if exists app_fn.paging_options cascade;
drop type if exists app_fn.workspace_resident_candidate cascade;
drop type if exists app_fn.ab_listing cascade;
drop type if exists app_fn.application_info cascade;
drop type if exists app_fn.license_pack_info cascade;
drop type if exists app_fn.license_pack_license_type_info cascade;
drop type if exists app_fn.license_type_info cascade;
drop type if exists app_fn.profile_claims cascade;
drop type if exists app_fn.module_info cascade;
drop type if exists app_fn.tool_info cascade;

commit;
