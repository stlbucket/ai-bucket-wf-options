-- Verify fnb:00000000010220_app on pg

begin;

select n.nspname from pg_namespace n where n.nspname = 'app';
select n.nspname from pg_namespace n where n.nspname = 'app_fn';

select id, name, type, status from app.tenant where false;
select id, email, status from app.profile where false;
select id, tenant_id, email, status, type from app.resident where false;
select 'removed'::app.resident_status;   -- workspace soft-remove marker must exist
select 'client'::app.tenant_type, 'organization'::app.tenant_type;  -- nestable node types must exist
-- the generalized nested-parent constraint must exist
select 1/count(*) from pg_constraint where conname = 'chk_nested_parent' and conrelid = 'app.tenant'::regclass;
select id, tenant_id, resident_id, license_type_key, status from app.license where false;
select key, name from app.application where false;
select key, application_key from app.license_type where false;
select key from app.license_pack where false;
select key from app.permission where false;

rollback;
