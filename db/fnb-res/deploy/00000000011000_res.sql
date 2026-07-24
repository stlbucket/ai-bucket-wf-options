-- URN registry (.claude/specs/urn-registry/_shared.data.md §4.1–4.3)
create schema res;
create schema res_fn;
create schema res_api;

------------------------------------------------------------------------ build_urn
-- THE grammar authority — urn:fnb:{tenant_id}:{module}:{type}:{id}. Lives here (not in the
-- functions change) because res.resource.urn below is generated from it. IMMUTABLE is
-- load-bearing (generated columns require it); the grammar is frozen — URNs are forever.
create function res_fn.build_urn(_tenant_id uuid, _module citext, _resource_type citext, _id uuid)
returns text
language sql
immutable parallel safe
as $$
  select 'urn:fnb:' || _tenant_id::text || ':' || _module::text || ':'
         || _resource_type::text || ':' || _id::text;
$$;

------------------------------------------------------------------------ resource
-- The central registry. id is the owning row's PK verbatim (no default) — one row per
-- registered business/identity object. Registry rows are never hard-deleted (archived_at
-- is the tombstone). Written only by the SECURITY DEFINER res_fn functions.
create table res.resource (
  id            uuid primary key
  ,tenant_id    uuid not null references app.tenant(id)
  ,module       citext not null
  ,resource_type citext not null
  ,urn          text not null
                  generated always as
                  (res_fn.build_urn(tenant_id, module, resource_type, id)) stored
  ,created_at   timestamptz not null default current_timestamp
  ,created_by_resident_id uuid null references app.resident(id)
  ,archived_at  timestamptz null                 -- tombstone; URNs are never reused
);
-- UNIQUE CONSTRAINT (not a bare index): FK targets (`references res.resource(urn)`) and
-- PostGraphile relation detection are constraint-driven.
alter table res.resource add constraint uq_resource_urn unique (urn);
create index idx_resource_tenant_module_type on res.resource (tenant_id, module, resource_type);

------------------------------------------------------------------------ module_permission
-- Registry visibility map: existence + type leak only, never payload.
-- permission_key IS NULL ⇒ plain tenant-membership check (jwt.tenant_id() = tenant_id).
create table res.module_permission (
  module         citext primary key
  ,permission_key citext null
);

insert into res.module_permission (module, permission_key) values
  ('app',     'p:app-user')      -- support tickets + tenant + resident registry rows
  ,('msg',     'p:discussions')
  ,('todo',    'p:todo')
  ,('poll',    'p:poll')
  ,('loc',     null)             -- loc.location policy is jwt.tenant_id() = tenant_id
  ,('wf',      null)             -- wf policies are membership-shaped (currently commented out)
  ,('storage', null);          -- tenant membership: admins hold app-admin only (no p:app-user)
