-- Revert fnb-app:00000000010295_otp_login from pg

begin;

drop function if exists app_fn.resolve_send_recipients(uuid, uuid[], text[]);
drop function if exists app_api.create_deep_link(text, text);
drop function if exists app_fn.create_deep_link(text, uuid, text, interval);
drop function if exists app_fn.session_info(uuid);
drop function if exists app_fn.verify_otp_login(uuid, text);
drop function if exists app_fn.request_otp_login(uuid, text);
drop function if exists app_fn.get_deep_link(uuid);
drop function if exists app_fn.activate_profile_residency_in_tenant(uuid, uuid);
drop function if exists app_fn.resolve_tenant_recipient(uuid, text);
drop function if exists app_fn.mask_destination(text, text);

drop type if exists app_fn.otp_login_result;
drop type if exists app_fn.otp_login_dispatch;
drop type if exists app_fn.deep_link_public;

drop table if exists auth.otp_login;
drop table if exists auth.deep_link;

commit;
