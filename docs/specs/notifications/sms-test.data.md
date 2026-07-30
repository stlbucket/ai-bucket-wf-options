# SMS-Test Page — Data (site-admin)

## Status
Draft — fill in all `[FILL IN]` sections before implementing. **Phase 0 of the SMS work** (D8/D10/D11).

## Send path — `triggerWorkflow` carve-out (identical shape to `send-test`)

Dispatches through the **existing** `triggerWorkflow` GraphQL mutation — the same registry entry the
email test + invite paths use — not a bespoke route:

```
triggerWorkflow(workflowKey: "send-notification", inputData: {
  channel: "SMS", templateKey, to /* E.164 */, vars, tenantId, profileId
}) → { runId? }        // fire-and-forget; the notify.notification row IS the evidence (log-sink)
```

- Composable: `useSmsTest()` in `packages/graphql-client-api/src/composables/useSmsTest.ts`,
  re-exported thinly at `apps/tenant-app/app/composables/useSmsTest.ts` (R1). Wraps the generated
  `triggerWorkflow` mutation hook. (May share a `useNotifyTest(channel)` core with `useSendTest`;
  `[FILL IN]` — decide one composable with a `channel` arg vs. two thin wrappers.)
- Permission: the mutation is already claims-gated (401 without claims); the **page** gate is
  `p:app-admin-super`. The workflow runs as `n8n_worker` and writes the row.
- No new DB mutation surface — SMS sends only originate inside the workflow (same forge-prevention
  posture as email + storage).

## The log-sink branch (what "captured" means)

`send-notification`'s `sms` branch keys on `NOTIFY_SMS_PROVIDER`:
- `log-sink` (dev, D10/D11) → **render the body**, call `notify_fn.record_send(channel='sms',
  provider='log-sink', status='sent', payload=<rendered body + vars>, …)`, **dispatch nothing**.
  The rendered body persisted in `payload` is exactly what the SMS-inbox table reads back.
- `twilio` (prod, Phase 5+) → Twilio Messages API call, then `record_send(provider='twilio', …)`
  with `provider_message_id`; delivery states arrive via `notification-webhook`.

## SMS inbox — read

- Operation: `RecentSmsNotifications` — `.graphql` query at
  `packages/graphql-client-api/src/graphql/notify/query/recentSmsNotifications.graphql` — selects the
  exposed `notify.notification` fields **including the rendered body projection** (id, status,
  templateKey, recipient, body/payload, provider, createdAt, sentAt), `condition: { channel: SMS }`,
  `orderBy: CREATED_AT_DESC`, `first: N`.
- RLS scopes it to the super-admin's tenant + tenant-less rows (`_shared.data.md` policy) — no
  explicit tenant filter needed; the `channel = SMS` condition is the only filter.
- Composable: `useRecentSmsNotifications()` (same package + thin re-export); returns
  `{ items, fetching, error, executeQuery }`. Re-run with
  `executeQuery({ requestPolicy: 'network-only' })` after a send (no `refresh`). May be the same
  `useRecentNotifications(channel?)` as `send-test`, filtered by channel.
- Mapper: `toNotification` (`src/mappers/notification.ts`) → `Notification` (`fnb-types`, R3).

## Requirements
- `'notify'` already in `graphile.config.ts` `schemas` (Phase 1). The **rendered-body column**
  (`payload`, or a dedicated `body`/`rendered_body` projection) must be exposed for SMS rows — this
  is new relative to the email `send-test`, which never needed the body. Reconcile with the
  PII/hide decision in `_shared.data.md` (Open Question there).
- `triggerWorkflow` already registered for `send-notification` (Phase 2); the `sms` log-sink branch
  must be implemented in the workflow (Phase 0 task).

## Open Questions
- [ ] One shared `useNotifyTest`/`useRecentNotifications(channel)` vs. per-channel composables.
- [ ] Which body field to expose (`payload` json vs. a scalar `rendered_body`) and whether to hide
      it from the email read type to keep the PII surface minimal.
