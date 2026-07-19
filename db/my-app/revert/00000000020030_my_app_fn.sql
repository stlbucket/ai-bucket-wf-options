-- Revert my-app:00000000020030_my_app_fn from pg

drop function if exists my_app_fn.install_my_app_application();
