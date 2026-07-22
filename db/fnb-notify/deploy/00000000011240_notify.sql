-- Deploy fnb-notify:00000000011240_notify to pg

begin;

create schema notify;

-- Enum names are unique across the exposed schemas (the PostGraphile 5 typeCodecName-collision
-- lesson from n8n.n8n_workflow_run_status — see db/fnb-n8n/deploy/00000000011200_n8n.sql).
CREATE TYPE notify.notification_channel AS ENUM ('email', 'sms');
CREATE TYPE notify.notification_status  AS ENUM (
  'queued',     -- row created, not yet dispatched
  'sent',       -- handed to the provider
  'delivered',  -- provider confirmed delivery (webhook)
  'opened',     -- email open (webhook; email-only)
  'bounced',    -- provider bounce (webhook)
  'failed'      -- dispatch or provider error
);

-- The outbox + delivery log. One row per outbound message (email now, sms later). Flat log — the
-- same deliberate ceiling as n8n.workflow_run: provider/SMTP transcript + retries stay in the
-- provider's log + the n8n execution log, correlated by provider_message_id / n8n_execution_id.
-- Writes happen ONLY via notify_fn (SECURITY DEFINER) over the n8n_worker connection; reads are
-- RLS-scoped to super admins.
CREATE TABLE notify.notification (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel notify.notification_channel NOT NULL,
  status  notify.notification_status  NOT NULL DEFAULT 'queued',
  template_key citext NOT NULL,               -- 'test' | 'user-invitation' | 'zitadel-init' | …
  recipient citext NOT NULL,                  -- email address or E.164 phone
  subject text,                               -- email only (null for sms)
  payload jsonb NOT NULL DEFAULT '{}'::jsonb, -- template vars (NOT the full rendered body — PII)
  tenant_id uuid REFERENCES app.tenant(id),   -- nullable (system/identity sends are tenant-less)
  profile_id uuid REFERENCES app.profile(id), -- nullable (recipient profile, when known)
  provider text,                              -- 'resend' | 'twilio' | 'mailpit' | 'log-sink'
  provider_message_id text,                   -- provider's id (correlate to delivery webhooks)
  n8n_execution_id text,                      -- the dispatching n8n $execution.id
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE INDEX idx_notify_notification_status  ON notify.notification (channel, status);
CREATE INDEX idx_notify_notification_tenant  ON notify.notification (tenant_id);
CREATE INDEX idx_notify_notification_provmsg ON notify.notification (provider_message_id);
CREATE INDEX idx_notify_notification_payload ON notify.notification USING gin (payload);

commit;
