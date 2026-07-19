-- Verify my-app:00000000020040_my_app_policies on pg
begin;

select has_schema_privilege('anon', 'my_app_api', 'usage');
select has_schema_privilege('anon', 'my_app_fn', 'usage');
select has_schema_privilege('anon', 'my_app', 'usage');

rollback;
