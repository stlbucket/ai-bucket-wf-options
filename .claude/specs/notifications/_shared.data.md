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

## Open Questions
- [ ] `payload` retention/redaction (store rendered body or template vars only?).
- [ ] `update_delivery` allowed status transitions (terminal-state protection).
- [ ] Self-read RLS policy (`profile_id = jwt.profile_id()`) — only if a user-facing history ships.
- [ ] Which columns to hide from the exposed read type.
