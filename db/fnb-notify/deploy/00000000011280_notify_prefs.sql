-- Deploy fnb-notify:00000000011280_notify_prefs to pg

begin;

-- User-owned notification preferences (D12) + the non-auth phone-verification OTP store (D13).
-- Unlike notify.notification (the outbox — writes only via notify_fn over the n8n_worker
-- connection), these are the USER's own rows: a public two-layer notify_api surface writes them,
-- RLS-scoped to jwt.profile_id(). Spec: .claude/specs/notifications/_shared.data.md (SMS additions).

-- One row per (profile, channel). `enabled` = the user picked this method; `verified_at` gates SMS
-- (email is implicitly verified — ZITADEL owns identity). `destination` is the resolved target
-- (E.164 phone / email); null falls back to app.profile.
CREATE TABLE notify.channel_preference (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES app.profile(id) ON DELETE CASCADE,
  channel notify.notification_channel NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  destination citext,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  UNIQUE (profile_id, channel)
);
CREATE INDEX idx_notify_channel_pref_profile ON notify.channel_preference (profile_id);

-- Ephemeral OTP store for the non-auth phone-verification round-trip. Codes are bcrypt-hashed,
-- expiring, and attempt-limited. Deny-all to clients (RLS with no policy, see _policies) + hidden
-- from PostGraphile — all access is via notify_fn (SECURITY DEFINER).
CREATE TABLE notify.phone_verification (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES app.profile(id) ON DELETE CASCADE,
  phone citext NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX idx_notify_phone_verif_profile ON notify.phone_verification (profile_id, consumed_at);

commit;
