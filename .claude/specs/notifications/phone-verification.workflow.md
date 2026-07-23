# `phone-verification` — n8n workflow

## Status
Draft — fill in all `[FILL IN]` sections before implementing. **SMS Phase 1** (D13).

The non-auth phone-verification sender. Generates + persists a one-time code and delivers it via the
single `send-notification` chokepoint. App-owned OTP is acceptable here (non-auth only, per
`sms-2fa.future.md`); auth-grade 2FA stays with ZITADEL (Phase 5+).

## Trigger

- Webhook (header-auth `X-Fnb-Webhook-Secret`), registered in `WORKFLOW_REGISTRY` under key
  `phone-verification`, reachable via the internal `triggerWorkflow('phone-verification', …)`
  surface (same pattern as `send-notification`). Gate: authenticated caller (claims injected by the
  trigger plugin); no special permission — a user verifies their **own** phone (`profileId` comes
  from the injected claims, not the client body — `[FILL IN]` confirm the trigger plugin forwards
  `jwt.profile_id()` so a caller can't request a code for someone else).

## Input contract

```jsonc
{ "phone": "+15551234567", "profileId": "<uuid, from claims>" }
```

## Steps

1. **Generate + persist** — `notify_fn.request_phone_verification(_profile_id, _phone)` (SECURITY
   DEFINER, run as `n8n_worker`):
   - generate a 6-digit code (`[FILL IN]` length),
   - store `code_hash` (not plaintext) + `expires_at` (`[FILL IN]` TTL, e.g. 10 min) in
     `notify.phone_verification`, resetting `attempts`,
   - invalidate any prior unconsumed code for that `(profile_id, phone)`,
   - **return the plaintext code to the workflow only**.
2. **Send** — enqueue the SMS through the normal sender: call `send-notification`'s `sms` branch
   (sub-workflow / HTTP to the `send-notification` webhook) with
   `{ channel:'sms', templateKey:'phone-verify', to: phone, vars:{ code }, profileId }`.
   - dev (`NOTIFY_SMS_PROVIDER=log-sink`) → renders "Your code is {{code}}" into `notify.notification`
     `payload`, dispatches nothing → the code is read from the **SMS-Test inbox** (`sms-test.ui.md`).
   - prod (`twilio`) → real SMS.
3. **Respond** — `{ runId }` (fire-and-forget; the client never receives the code).

## Verify (not this workflow — a DB mutation)

Code checking is the public `notify_api.verify_phone_code` mutation (`profile-preferences.data.md`),
**not** an n8n workflow — verification is a synchronous DB check the user submits, no send involved.
Kept out of n8n on purpose (R22 is about *engine/dispatch*, not every DB read).

## Registry + import
- Add `phone-verification` to `WORKFLOW_REGISTRY` (authenticated; `[FILL IN]` confirm the exact
  registry file per the n8n-parallel-engine spec — same Open Question as `send-notification`).
- `n8n/workflows/phone-verification.json` loaded by `n8n-import`.

## Open Questions
- [ ] Confirm the trigger plugin sources `profileId` from claims, not the client body (anti-spoof).
- [ ] Code length, TTL, max attempts, resend cooldown (shared constants with `notify_fn`).
- [ ] Reuse `send-notification` via HTTP call vs. an n8n sub-workflow node.
