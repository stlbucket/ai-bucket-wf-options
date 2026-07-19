-- Verify my-app:00000000020030_my_app_fn on pg
begin;

select has_function_privilege('my_app_fn.install_my_app_application()', 'execute');

rollback;
