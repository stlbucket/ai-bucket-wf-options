-- Verify fnb-notify:00000000011290_notify_prefs_fn on pg

select 1/count(*) from pg_proc where proname = 'set_channel_preference'    and pronamespace = 'notify_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'request_phone_verification' and pronamespace = 'notify_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'verify_phone_code'          and pronamespace = 'notify_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'set_channel_preference'     and pronamespace = 'notify_api'::regnamespace;
select 1/count(*) from pg_proc where proname = 'verify_phone_code'          and pronamespace = 'notify_api'::regnamespace;

select pg_catalog.has_function_privilege('authenticated', 'notify_fn.set_channel_preference(notify.notification_channel, boolean)', 'execute');
select pg_catalog.has_function_privilege('authenticated', 'notify_fn.verify_phone_code(citext, text)', 'execute');
