# `notification-webhook` — n8n provider-callback workflow

## Status
Draft — fill in all `[FILL IN]` sections before implementing.

Receives delivery events from the provider (Resend now, Twilio in Phase 5+) and advances the
`notify.notification` row so the log reflects reality (delivered / opened / bounced / failed).
File: `n8n/workflows/notification-webhook.json`. This is *inbound* from the provider — it is **not**
in the `triggerWorkflow` registry (no app caller); the provider calls it directly.

## Trigger

- **Webhook Trigger** node, path `notification-webhook` → n8n `/webhook/notification-webhook`.
- Exposed publicly through Caddy (`[FILL IN]` — confirm the n8n webhook path prefix Caddy routes)
  so Resend/Twilio can reach it.
- **Verify the signature** before acting:
  - Resend: `svix`-style signature using `RESEND_WEBHOOK_SECRET`.
  - Twilio: `X-Twilio-Signature` HMAC (Phase 5+).
  Reject unsigned/invalid payloads (respond 401).

## Node flow

```
Webhook (notification-webhook)
  → Verify signature (Code node; drop on mismatch)
  → Map event → status
       Resend:  email.delivered → 'delivered'
                email.opened    → 'opened'
                email.bounced   → 'bounced'
                email.complained/failed → 'failed'
       Twilio:  message-status delivered/undelivered/failed → mapped   (Phase 5+)
  → Postgres (n8n_worker cred):
       select notify_fn.update_delivery(providerMessageId, status, error)
```

`providerMessageId` is the correlation key — the send workflow stored the provider's id on the row;
the webhook carries it back. `update_delivery` matches on it and advances status without regressing
a terminal state (`[FILL IN]` — confirm the transition rules defined in `_shared.data.md`).

## Idempotency

Providers may deliver the same event more than once. `update_delivery` must be safe to re-apply
(no-op if the row is already at/past that status). Unknown `providerMessageId` (e.g. a mail sent
outside this pipeline) → log + 200, no row change.

## Verify
- [ ] A Resend test event for a real `providerMessageId` flips the row `sent → delivered`.
- [ ] A tampered/ unsigned payload is rejected (401), no DB write.
- [ ] Duplicate event is a no-op.
