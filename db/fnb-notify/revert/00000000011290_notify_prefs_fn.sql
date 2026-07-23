-- Revert fnb-notify:00000000011290_notify_prefs_fn from pg

begin;

drop function if exists notify_api.verify_phone_code(citext, text);
drop function if exists notify_api.set_channel_preference(notify.notification_channel, boolean);
drop function if exists notify_fn.verify_phone_code(citext, text);
drop function if exists notify_fn.request_phone_verification(uuid, citext);
drop function if exists notify_fn.set_channel_preference(notify.notification_channel, boolean);

commit;
