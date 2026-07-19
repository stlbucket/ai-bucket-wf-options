alter table app.support_ticket drop constraint if exists fk_support_ticket_resource;
alter table app.support_ticket drop constraint if exists uq_support_ticket_urn;
alter table app.support_ticket drop column if exists urn;

alter table app.resident drop constraint if exists fk_resident_resource;
alter table app.resident drop constraint if exists uq_resident_urn;
alter table app.resident drop column if exists urn;

alter table app.tenant drop constraint if exists fk_tenant_resource;
alter table app.tenant drop constraint if exists uq_tenant_urn;
alter table app.tenant drop column if exists urn;
