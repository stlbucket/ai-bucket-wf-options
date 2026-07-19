select pg_catalog.has_schema_privilege('res', 'usage');
select pg_catalog.has_schema_privilege('res_fn', 'usage');
select pg_catalog.has_schema_privilege('res_api', 'usage');
select id, tenant_id, module, resource_type, urn, created_at, created_by_resident_id, archived_at
  from res.resource where false;
select 1/(select count(*)::int from res.module_permission)  -- seeded (6 rows); div-by-zero if empty
;
select res_fn.build_urn(
  '00000000-0000-0000-0000-000000000000'::uuid, 'app'::citext, 'tenant'::citext,
  '00000000-0000-0000-0000-000000000000'::uuid);
