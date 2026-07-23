-- Revert fnb-notify:00000000011300_notify_prefs_policies from pg

begin;

revoke execute on function notify_fn.request_phone_verification(uuid, citext) from n8n_worker;
revoke usage on schema notify_fn from authenticated;

drop policy if exists channel_pref_self on notify.channel_preference;
alter table notify.channel_preference disable row level security;
alter table notify.phone_verification disable row level security;

commit;
