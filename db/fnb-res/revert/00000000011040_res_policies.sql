drop policy if exists resource_select on res.resource;
drop policy if exists view_module_permission on res.module_permission;

alter table res.module_permission disable row level security;
alter table res.resource disable row level security;

revoke select on res.resource, res.module_permission from authenticated, service_role;
revoke execute on all functions in schema res from authenticated, service_role;
revoke all on all routines in schema res_api from authenticated, service_role;
revoke all on all routines in schema res_fn from authenticated, service_role;
revoke usage on schema res, res_fn, res_api from anon, authenticated, service_role;
