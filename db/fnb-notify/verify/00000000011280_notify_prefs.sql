-- Verify fnb-notify:00000000011280_notify_prefs on pg

select id, profile_id, channel, enabled, destination, verified_at, created_at, updated_at
from notify.channel_preference
where false;

select id, profile_id, phone, code_hash, expires_at, attempts, consumed_at, created_at
from notify.phone_verification
where false;
