-- Verify my-app:00000000020010_my_app on pg
begin;

select pg_catalog.has_schema_privilege('my_app', 'usage');
select pg_catalog.has_schema_privilege('my_app_fn', 'usage');
select pg_catalog.has_schema_privilege('my_app_api', 'usage');
select 1/count(*) from information_schema.tables where table_schema = 'my_app' and table_name = 'thing';

rollback;
