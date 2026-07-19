-- App-package retrofit (.claude/specs/urn-registry/_shared.data.md §4.6).
-- The three fnb-app registered tables get their urn DDL HERE (not in fnb-app) because
-- fnb-app deploys before res_fn.build_urn exists. Register calls live in the app_fn bodies
-- (plpgsql resolves at execution — seed time — not definition time).

------------------------------------------------------------------------ app.tenant
alter table app.tenant
  add column urn text not null
    generated always as (res_fn.build_urn(id, 'app', 'tenant', id)) stored;  -- own id IS the tenant segment
alter table app.tenant add constraint uq_tenant_urn unique (urn);
alter table app.tenant
  add constraint fk_tenant_resource foreign key (id) references res.resource(id)
  deferrable initially deferred;

------------------------------------------------------------------------ app.resident
alter table app.resident
  add column urn text not null
    generated always as (res_fn.build_urn(tenant_id, 'app', 'resident', id)) stored;
alter table app.resident add constraint uq_resident_urn unique (urn);
alter table app.resident
  add constraint fk_resident_resource foreign key (id) references res.resource(id)
  deferrable initially deferred;

------------------------------------------------------------------------ app.support_ticket
alter table app.support_ticket
  add column urn text not null
    generated always as (res_fn.build_urn(tenant_id, 'app', 'support_ticket', id)) stored;
alter table app.support_ticket add constraint uq_support_ticket_urn unique (urn);
alter table app.support_ticket
  add constraint fk_support_ticket_resource foreign key (id) references res.resource(id)
  deferrable initially deferred;
