-- Verify fnb:00000000010230_app_fn_types on pg

begin;

select n.nspname from pg_namespace n where n.nspname = 'app_api';

select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app_fn' and t.typname = 'tool_info';
select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app_fn' and t.typname = 'module_info';
select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app_fn' and t.typname = 'profile_claims';
select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app_fn' and t.typname = 'application_info';
select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'app_fn' and t.typname = 'license_pack_info';

rollback;
