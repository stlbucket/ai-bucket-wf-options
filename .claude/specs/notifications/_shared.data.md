# Notifications — Shared Data (`fnb-notify` DB module)

## Status
Draft — fill in all `[FILL IN]` sections before implementing.

The `fnb-notify` sqitch package: schemas `notify` / `notify_fn` / `notify_api` (the house trio).
Precedent for every pattern here is **`fnb-n8n`** — `db/fnb-n8n/deploy/00000000011200_n8n.sql`
(flat log table) and `…011230_n8n_policies.sql` (RLS + `n8n_worker` role grants). `fnb-notify`
deploys **immediately after `fnb-n8n`** so the `n8n_worker` role already exists.

## Schema layout

| Schema | Purpose |
|---|---|
| `notify` | Tables + enums. `notify.notification` is the outbox + delivery log. |
| `notify_fn` | Internal logic, **SECURITY DEFINER** writers called by n8n over the `n8n_worker` connection. |
| `notify_api` | PostGraphile read surface (SECURITY INVOKER). No public mutations — writes happen only in the workflow. |

## Enums

Named to avoid the PostGraphile 5 `typeCodecName` collision documented in
`00000000011200_n8n.sql:7-11` — both names are unique across the exposed schemas.

```sql
CREATE TYPE notify.notification_channel AS ENUM ('email', 'sms');
CREATE TYPE notify.notification_status  AS ENUM (
  'queued',     -- row created, not yet dispatched
  'sent',       -- handed to the provider
  'delivered',  -- provider confirmed delivery (webhook)
  'opened',     -- email open (webhook; email-only)
  'bounced',    -- provider bounce (webhook)
  'failed'      -- dispatch or provider error
);
```

## Table: `notify.notification`

The outbox + audit log. One row per outbound message. Mirrors `n8n.workflow_run`'s flat-log
posture — step detail (SMTP transcript, provider retries) stays in the provider/n8n execution log,
correlated by `provider_message_id` / `n8n_execution_id`.

```sql
CREATE TABLE notify.notification (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel notify.notification_channel NOT NULL,
  status  notify.notification_status  NOT NULL DEFAULT 'queued',
  template_key citext NOT NULL,              -- 'user-invitation' | 'zitadel-init' | 'test' | …
  recipient citext NOT NULL,                 -- email address or E.164 phone
  subject text,                              -- email only (null for sms)
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,-- template variables (+ rendered body snapshot)
  tenant_id uuid REFERENCES app.tenant(id),  -- nullable (system/identity sends are tenant-less)
  profile_id uuid REFERENCES app.profile(id),-- nullable (recipient profile, when known)
  provider text,                             -- 'resend' | 'twilio' | 'mailpit' | 'log-sink'
  provider_message_id text,                  -- provider's id (correlate to webhooks)
  n8n_execution_id text,                     -- the dispatching n8n $execution.id
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX idx_notify_notification_status  ON notify.notification (channel, status);
CREATE INDEX idx_notify_notification_tenant  ON notify.notification (tenant_id);
CREATE INDEX idx_notify_notification_provmsg ON notify.notification (provider_message_id);
CREATE INDEX idx_notify_notification_payload ON notify.notification USING gin (payload);
```

**PII note (Open Question):** `payload` may hold a rendered body + recipient. Retention/redaction
policy is `[FILL IN]`. Consider storing template vars only (not the full rendered body) if that is
sufficient for the audit trail.

## Functions (`notify_fn`, SECURITY DEFINER — called by `n8n_worker`)

```
notify_fn.record_send(
  _channel notify.notification_channel,
  _template_key citext,
  _recipient citext,
  _subject text,
  _payload jsonb,
  _tenant_id uuid,
  _profile_id uuid,
  _provider text,
  _provider_message_id text,
  _status notify.notification_status,        -- 'sent' on success, 'failed' on error
  _error jsonb
) returns uuid                               -- the notification id
```
Idempotent-friendly: the workflow inserts one row per send. (Enqueue-then-update is an option —
insert `queued` before the provider call, update to `sent`/`failed` after — decide in the workflow
spec; the function surface supports both.)

```
notify_fn.update_delivery(
  _provider_message_id text,
  _status notify.notification_status,        -- 'delivered' | 'opened' | 'bounced' | 'failed'
  _error jsonb
) returns void
```
Called by the callback workflow on a provider webhook; matches the row by `provider_message_id`,
advances `status`, sets `updated_at`. Never regresses a terminal status (`[FILL IN]` — define the
allowed transitions, e.g. don't overwrite `bounced` with a late `delivered`).

## Grants + RLS (mirror `00000000011230_n8n_policies.sql`)

```sql
-- notify_api: exposed read surface
grant usage on schema notify_api to anon, authenticated, service_role;
grant all on all routines in schema notify_api to anon, authenticated, service_role;
alter default privileges for role postgres in schema notify_api
  grant all on routines to anon, authenticated, service_role;

-- notify: reads are RLS-scoped; writes happen only via notify_fn SECURITY DEFINER
grant usage on schema notify to anon, authenticated, service_role;
grant select on all tables in schema notify to anon, authenticated, service_role;
alter default privileges for role postgres in schema notify
  grant select on tables to anon, authenticated, service_role;

alter table notify.notification enable row level security;

-- Super admins see their (anchor) tenant's notifications + tenant-less rows
-- (identical shape to n8n.workflow_run.view_runs_super_admin).
CREATE POLICY view_notifications_super_admin ON notify.notification
  FOR SELECT
  USING (
    jwt.has_permission('p:app-admin-super', tenant_id)
    OR (tenant_id IS NULL AND jwt.has_permission('p:app-admin-super'))
  );
-- Optional (Open Question): a self-read policy so a recipient can see their own notifications
--   USING (profile_id = jwt.profile_id())
-- Defer unless a user-facing "notification history" surfaces.

-- no insert/update/delete policies: writes happen only inside notify_fn (SECURITY DEFINER).

-- n8n_worker: the workflow's DB credential executes exactly the notify_fn surface.
grant usage on schema notify to n8n_worker;
grant usage on schema notify_fn to n8n_worker;
grant execute on all functions in schema notify_fn to n8n_worker;
alter default privileges for role postgres in schema notify_fn
  grant execute on functions to n8n_worker;
```

## PostGraphile exposure

Add **only** `'notify'` to `graphile.config.ts` `schemas` (never `notify_fn`). `notify_api` may be
exposed for read helpers if needed, but the table read via RLS is enough for the site-admin
recent-sends list. This mirrors the storage decision (expose the table, keep `_fn` hidden) so no
mutation can forge a notification — sends only originate inside the workflow.

Hide sensitive columns if the recent-sends list doesn't need them (`payload`, `error`) via
`postgraphile.tags.json5` behaviors (`-select -filterBy -orderBy`) — `[FILL IN]` decide per the
test-page needs.

## fnb-types

`packages/fnb-types/src/notification.ts` — the shared vocabulary (R3):

```ts
export type NotificationChannel = 'EMAIL' | 'SMS'          // UPPERCASE, mirrors the GraphQL enum
export type NotificationStatus =
  'QUEUED' | 'SENT' | 'DELIVERED' | 'OPENED' | 'BOUNCED' | 'FAILED'

export type Notification = {
  id: string
  channel: NotificationChannel
  status: NotificationStatus
  templateKey: string
  recipient: string
  subject: string | null
  tenantId: string | null
  provider: string | null
  createdAt: Date
  sentAt: Date | null
}
```
Barrel-export from `packages/fnb-types/src/index.ts`. Codegen types stay internal to
`graphql-client-api`, bridged by a mapper `src/mappers/notification.ts` (`toNotification`).

## Permission keys

| Key | Gates |
|---|---|
| `p:app-admin-super` | View all notifications (RLS) + the `send-test` page |

No new permission key is required for v1 — the invitation send is system-initiated inside the
workflow (runs as `n8n_worker`, not a user). The test page reuses `p:app-admin-super`.

## SMS additions — channel preferences + phone verification (D12/D13)

Added for the SMS work: user-chosen **preferred method(s)** (`profile-preferences.*`) and the
non-auth **phone-verification** gate (D13). Both tables live in `notify` and are **user-owned** —
unlike `notify.notification` (writes only inside the workflow), these carry a **public mutation
surface** (`notify_api` two-layer, R8) RLS-scoped to `profile_id = jwt.profile_id()`.

### Table: `notify.channel_preference`

One row per `(profile, channel)`. `enabled` = the user selected this method; `verified_at` gates
SMS (email is implicitly verified — ZITADEL owns identity).

```sql
CREATE TABLE notify.channel_preference (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES app.profile(id) ON DELETE CASCADE,
  channel notify.notification_channel NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  destination citext,                          -- resolved target: E.164 phone (sms) / email (email); null → fall back to app.profile
  verified_at timestamptz,                     -- email: set on create; sms: set by verify_phone_code
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  UNIQUE (profile_id, channel)
);
CREATE INDEX idx_notify_channel_pref_profile ON notify.channel_preference (profile_id);
```

### Table: `notify.phone_verification`

Ephemeral OTP store for the non-auth phone-verification round-trip. Codes are **hashed**, expiring,
attempt-limited. Consumed rows are kept for audit (or reaped — `[FILL IN]`).

```sql
CREATE TABLE notify.phone_verification (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES app.profile(id) ON DELETE CASCADE,
  phone citext NOT NULL,                        -- E.164
  code_hash text NOT NULL,                      -- never store plaintext
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX idx_notify_phone_verif_profile ON notify.phone_verification (profile_id, consumed_at);
```

### Functions (extends `notify_fn` / `notify_api`)

```
-- Preferences (user-owned; two-layer R8)
notify_api.set_channel_preference(_channel notify.notification_channel, _enabled boolean) returns notify.channel_preference
  -- SECURITY INVOKER → notify_fn.set_channel_preference (DEFINER): upsert on (jwt.profile_id(), _channel).
  -- RAISES if enabling 'sms' while its verified_at is null (D13 belt-and-suspenders).

-- Phone verification
notify_fn.request_phone_verification(_profile_id uuid, _phone citext) returns text  -- returns plaintext code (n8n_worker only)
  -- generate 6-digit code, store code_hash + expires_at, invalidate prior unconsumed rows, reset attempts.
notify_api.verify_phone_code(_phone citext, _code text) returns jsonb  -- { verified, reason? }
  -- SECURITY INVOKER → notify_fn.verify_phone_code (DEFINER): newest unconsumed row for jwt.profile_id();
  --   check hash + expiry + attempts; on success mark consumed + upsert channel_preference(sms).verified_at/destination
  --   (+ optionally app.profile.phone). Increments attempts on failure.
```

### Grants + RLS (self-owned)

```sql
alter table notify.channel_preference enable row level security;
alter table notify.phone_verification enable row level security;

-- A user reads/writes only their own preference rows.
CREATE POLICY channel_pref_self ON notify.channel_preference
  FOR SELECT USING (profile_id = jwt.profile_id());
-- No direct INSERT/UPDATE policy: writes go through notify_fn (DEFINER) called by notify_api,
-- which binds profile_id = jwt.profile_id(). (Same forge-prevention posture as the outbox.)

-- phone_verification: no client SELECT (codes are hashed and never read by the client);
-- all access is via notify_fn DEFINER. Grant execute on the new notify_fn routines to n8n_worker
-- (request_phone_verification) — verify_* runs as the authenticated caller via notify_api.
grant execute on all functions in schema notify_fn to n8n_worker;  -- default-privileges already cover new fns
```

### fnb-types (extends `packages/fnb-types/src/notification.ts`)

```ts
export type ChannelPreference = {
  channel: NotificationChannel          // 'EMAIL' | 'SMS'
  enabled: boolean
  destination: string | null
  verifiedAt: Date | null
}
```
Barrel-export alongside `Notification`; mapper `toChannelPreference` (`src/mappers/channelPreference.ts`).

### Permission keys (addition)

| Key | Gates |
|---|---|
| _authenticated_ (no new key) | Read/write **own** channel preferences + verify **own** phone (RLS `profile_id = jwt.profile_id()`) |

No new permission key — preferences are self-owned, gated by RLS on the caller's profile, not a
license permission.

## Open Questions
- [ ] `payload` retention/redaction (store rendered body or template vars only?). **Interacts with
      the SMS-Test page** — the log-sink inbox *needs* the rendered body visible (`sms-test.data.md`),
      so decide the body projection + whether to hide it from the email read type.
- [ ] `update_delivery` allowed status transitions (terminal-state protection).
- [ ] Self-read RLS policy on `notify.notification` (`profile_id = jwt.profile_id()`) — only if a
      user-facing history ships (distinct from the preference self-read above, which is required).
- [ ] Which columns to hide from the exposed read type.
- [ ] Phone-verification constants: code length, TTL, max attempts, resend cooldown.
- [ ] Mirror the verified number to `app.profile.phone`, or keep it only on the SMS preference
      `destination`? (Recommend mirroring for a single source of truth.)
- [ ] `phone_verification` retention (keep consumed rows for audit vs. reap).
