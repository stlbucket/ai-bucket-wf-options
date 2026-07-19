-- res_api + computed hub fields (.claude/specs/urn-registry/_shared.data.md §4.4, §4.7)

------------------------------------------------------------------------ resolve_urn
-- SECURITY INVOKER + STABLE ⇒ RLS applies; PostGraphile exposes it as a query field.
create function res_api.resolve_urn(_urn text)
returns res.resource
language sql
stable
as $$
  select r.* from res.resource r where r.urn = _urn;
$$;

------------------------------------------------------------------------ computed hub fields
-- res.resource.id is polymorphic, so PostGraphile cannot auto-relate a resource to its
-- underlying entity. These computed columns (schema-of-table + <table>_<field> naming,
-- SECURITY INVOKER ⇒ target RLS applies) cover the two identity types the UI needs for
-- display names. Other types stay polymorphic — parseUrn client-side + the module's query.

-- Resource.resident — non-null only when the resource IS a resident
create function res.resource_resident(r res.resource)
returns app.resident
language sql
stable
as $$
  select a.* from app.resident a
  where a.id = r.id and r.module = 'app' and r.resource_type = 'resident';
$$;

-- Resource.tenant — resolves for EVERY resource (its owning tenant)
create function res.resource_tenant(r res.resource)
returns app.tenant
language sql
stable
as $$
  select t.* from app.tenant t where t.id = r.tenant_id;
$$;
