create schema if not exists app_api;

----------------------------------------------------------------------------------------------
create type app_fn.tool_info as (
  key citext
  ,name citext
  ,permission_keys citext[]
  ,default_icon_key citext
  ,route citext
  ,ordinal integer
);
----------------------------------------------------------------------------------------------
create type app_fn.module_info as (
  key citext
  ,name citext
  ,permission_keys citext[]
  ,default_icon_key citext
  ,ordinal integer
  ,tools app_fn.tool_info[]
);
----------------------------------------------------------------------------------------------
create type app_fn.profile_claims as (
  profile_id uuid
  ,tenant_id uuid
  ,resident_id uuid
  ,actual_resident_id uuid
  ,profile_status app.profile_status
  ,permissions citext[]
  ,email citext
  ,display_name citext
  ,tenant_name citext
  ,tenant_type app.tenant_type
  ,modules app_fn.module_info[]
);
----------------------------------------------------------------------------------------------
-- Candidate row for the workspace "Manage Residents" pool: one distinct person (profile) in the
-- current workspace's tenant tree, with whether they are a member of THIS workspace.
create type app_fn.workspace_resident_candidate as (
  profile_id uuid
  ,email citext
  ,display_name citext
  ,full_name citext
  ,home_tenant_name citext
  ,workspace_resident_id uuid
  ,workspace_status app.resident_status
  ,is_member boolean
);
----------------------------------------------------------------------------------------------
create type app_fn.license_type_info as (
  key citext
  ,display_name citext
  ,permissions citext[]
  ,assignment_scope app.license_type_assignment_scope
);
----------------------------------------------------------------------------------------------
create type app_fn.license_pack_license_type_info as (
  license_type_key citext
  ,number_of_licenses integer
  ,expiration_interval_type app.expiration_interval_type
  ,expiration_interval_multiplier integer
);
----------------------------------------------------------------------------------------------
create type app_fn.license_pack_info as (
  key citext
  ,display_name citext
  ,description citext
  ,license_pack_license_type_infos app_fn.license_pack_license_type_info[]
  ,auto_subscribe boolean
);
----------------------------------------------------------------------------------------------
create type app_fn.application_info as (
  key citext
  ,name citext
  ,license_type_infos app_fn.license_type_info[]
  ,license_pack_infos app_fn.license_pack_info[]
  ,modules app_fn.module_info[]
);
----------------------------------------------------------------------------------------------
create type app_fn.ab_listing as (
  profile_id uuid
  ,email citext
  ,phone citext
  ,full_name citext
  ,display_name citext
  ,can_invite boolean
);
-----------------------------------------------
create type app_fn.paging_options as (
  item_offset integer
  ,page_offset integer
  ,item_limit integer
);
-----------------------------------------------
create type app_fn.search_residents_options as (
  search_term citext
  ,status app.resident_status
  ,paging_options app_fn.paging_options
);
-----------------------------------------------
create type app_fn.search_profiles_options as (
  search_term citext
  ,status app.profile_status
  ,paging_options app_fn.paging_options
);
-----------------------------------------------
create type app_fn.search_tenants_options as (
  search_term citext
  ,status app.tenant_status
  ,type app.tenant_type
  ,paging_options app_fn.paging_options
);
-----------------------------------------------
create type app_fn.residency_tree_node as (
  tenant_id uuid
  ,tenant_name citext
  ,tenant_type app.tenant_type
  ,tenant_status app.tenant_status
  ,parent_tenant_id uuid
  ,resident_id uuid              -- null ⇒ ghost ancestor node (no residency)
  ,resident_status app.resident_status
  ,resident_type app.resident_type
);
