-- Revert my-app:00000000020010_my_app from pg
begin;

drop schema if exists my_app cascade;
drop schema if exists my_app_fn cascade;
drop schema if exists my_app_api cascade;

commit;
