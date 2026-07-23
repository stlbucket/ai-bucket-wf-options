-- Deploy fnb-notify:00000000011300_notify_prefs_policies to pg

-- channel_preference + phone_verification are user-owned. SELECT grants come from the notify-schema
-- default privileges set in 011270 (grant select on tables to anon/authenticated/service_role);
-- these tables were created afterward, so they inherit them. Here: RLS + the n8n_worker grant.

------------------------------------------------------------------------ RLS
alter table notify.channel_preference enable row level security;
alter table notify.phone_verification enable row level security;

-- A user reads only their OWN channel preferences. Writes go through notify_fn (SECURITY DEFINER,
-- bound to jwt.profile_id()), so no client insert/update/delete policy — the user-owned counterpart
-- to notify.notification's super-admin read policy.
CREATE POLICY channel_pref_self ON notify.channel_preference
  FOR SELECT
  USING (profile_id = jwt.profile_id());

-- phone_verification: deny-all to clients (RLS enabled, NO policy). Hashed OTP rows are never read
-- by the client — all access is via notify_fn (SECURITY DEFINER). Also hidden from PostGraphile
-- (apps/graphql-api-app/postgraphile.tags.json5 behavior '-*').

------------------------------------------------------------------------ authenticated → notify_fn
-- notify_api (SECURITY INVOKER) runs as `authenticated` and delegates to the user-facing notify_fn
-- writers. Calling a function needs USAGE on its schema AND EXECUTE on the function — 011270 grants
-- notify_fn schema usage to n8n_worker only, so authenticated needs its own USAGE grant here. This
-- is safe: the other notify_fn writers (record_send/update_delivery/request_phone_verification) are
-- execute-granted to n8n_worker only, so authenticated can still call ONLY the two prefs functions
-- it was explicitly granted (011290).
grant usage on schema notify_fn to authenticated;

------------------------------------------------------------------------ n8n_worker
-- The phone-verification workflow (over the n8n_worker connection) mints the OTP. Explicit for
-- clarity — the notify_fn default privileges (011270) already grant execute to n8n_worker on new
-- functions in the schema.
grant execute on function notify_fn.request_phone_verification(uuid, citext) to n8n_worker;
