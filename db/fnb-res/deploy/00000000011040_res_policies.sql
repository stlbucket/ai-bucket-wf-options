-- Grants + RLS (.claude/specs/urn-registry/_shared.data.md §4.5).
-- SELECT-only registry: NO insert/update/delete grants on res.resource to any request
-- role — only the SECURITY DEFINER res_fn functions write it.

grant usage on schema res, res_fn, res_api to anon, authenticated, service_role;
grant all on all routines in schema res_fn to authenticated, service_role;
grant all on all routines in schema res_api to authenticated, service_role;
-- computed hub fields (res.resource_resident / res.resource_tenant) run as the request role
grant execute on all functions in schema res to authenticated, service_role;
grant select on res.resource, res.module_permission to authenticated, service_role;

alter table res.resource enable row level security;
alter table res.module_permission enable row level security;

create policy view_module_permission on res.module_permission for select using (true);

-- Existence/type visibility per the seeded map: permission-gated modules check the key
-- against the row's tenant; NULL-key modules fall back to tenant membership. Super sees all.
create policy resource_select on res.resource for select using (
  jwt.has_permission('p:app-admin-super')
  or exists (
    select 1 from res.module_permission mp
    where mp.module = resource.module
      and (
        (mp.permission_key is not null
          and jwt.has_permission(mp.permission_key, resource.tenant_id))
        or (mp.permission_key is null and jwt.tenant_id() = resource.tenant_id)
      )
  )
);
