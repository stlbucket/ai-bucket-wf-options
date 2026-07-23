-- Revert fnb-notify:00000000011280_notify_prefs from pg

begin;

drop table if exists notify.phone_verification;
drop table if exists notify.channel_preference;

commit;
