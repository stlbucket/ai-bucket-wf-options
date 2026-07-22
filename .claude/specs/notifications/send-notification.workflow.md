# `send-notification` — n8n dispatch workflow

## Status
Draft — fill in all `[FILL IN]` sections before implementing.

The single outbound-message chokepoint (D1). Every send — email now, SMS later — enters here.
File: `n8n/workflows/send-notification.json`. Precedent: `exerciser.json` (Webhook Trigger +
Postgres nodes over the `n8n_worker` credential) and the n8n-parallel-engine spec.

## Trigger + registry

- **Webhook Trigger** node, path `send-notification` → n8n `/webhook/send-notification`.
- Register in the `WORKFLOW_REGISTRY` of
  `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts` (global-rules R22, §157) so
  callers reach it via `triggerWorkflow(workflowKey: "send-notification", inputData: {...})`.
- Also register in `n8n-import` so it loads on env build.

## Input contract (webhook body)

```jsonc
{
  "channel": "email",              // "email" | "sms"
  "templateKey": "user-invitation",// resolves a template (inline for v1)
  "to": "person@example.com",      // email address or E.164 phone
  "subject": "You're invited",     // email only; omit/null for sms
  "vars": { "displayName": "Kev", "loginUrl": "https://…/auth" },
  "tenantId": null,                // nullable
  "profileId": null                // nullable
}
```

## Node flow

```
Webhook (send-notification)
  → Validate (Set/If: channel ∈ {email,sms}; to present; subject present when email)
  → Route by channel (If / Switch)
      ├─ EMAIL:
      │    → Render template (Code/Set: templateKey + vars → { subject, html/text })
      │    → Provider (env NOTIFY_EMAIL_PROVIDER):
      │        • mailpit → Send Email node (SMTP host NOTIFY_SMTP_HOST:NOTIFY_SMTP_PORT)
      │        • resend  → HTTP Request node (POST api.resend.com, RESEND_API_KEY)
      └─ SMS (Phase 5+):
           → Provider (env NOTIFY_SMS_PROVIDER):
               • log-sink → no dispatch (record only)     ← dev default (D10)
               • twilio   → HTTP Request (Twilio Messages API)
  → Record (Postgres node, n8n_worker cred):
       select notify_fn.record_send(channel, templateKey, to, subject, payload,
                                     tenantId, profileId, provider, providerMessageId,
                                     status, error)
       -- status = 'sent' on provider success, 'failed' on error (wire the error branch)
```

**Enqueue-then-update option:** insert `queued` up front (a first `record_send` with
`status='queued'`), then a second update after the provider call. v1 may do the single
success/failure insert; the `notify_fn` surface supports both (see `_shared.data.md`).

## Template rendering (v1 = inline)

Templates live inside the workflow (a Code/Set node keyed by `templateKey`) for v1. Keys:
`user-invitation` (v1), `zitadel-init` / `zitadel-verify` (Phase for codes), `test` (Phase 4).
A `notify.template` table (admin-editable / i18n) is deferred — see README Open Questions.

## Error handling

- Provider failure → record `status='failed'` with `error` populated; rely on n8n per-node retry
  (`[FILL IN]` — set retry count/backoff on the provider node). A reaper over `queued`/`failed`
  is a deferred Open Question.
- Wire the workflow to the existing `error-handler` workflow (`n8n/workflows/error-handler.json`)
  as its Error Workflow so failures are logged consistently.

## Verify
- [ ] `triggerWorkflow(workflowKey:"send-notification", inputData:{channel:"email",…})` →
      a message appears in Mailpit (`:8025`) and a `notify.notification` row goes `→ sent`.
- [ ] Missing `to` / bad `channel` → validation stop, `failed` row, no provider call.
