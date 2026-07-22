# SMS & 2FA — future design

## Status
**Future** — design locked (D8/D9), implementation deferred to Phase 5+. `fnb-notify` is built
multi-channel from day one (the `channel` enum + `notify.notification` already carry SMS), so this
adds a dispatch branch + ZITADEL wiring, **no DB migration**.

## The core split

> **ZITADEL owns the MFA *logic*; n8n owns the *delivery*.**

There are two kinds of SMS, and they route differently:

### 1. Auth-grade 2FA (the login step-up) — ZITADEL owns it
The step-up already happens *inside* the OIDC login redirect. ZITADEL handles code generation,
rate-limiting, replay protection, lockout, and recovery codes — all the IdP-grade security you do
**not** want to reimplement. So enable ZITADEL's MFA/login policy and let it run the ceremony.

The delivery unification: ZITADEL supports pointing SMS at a **generic HTTP SMS provider** (Instance
→ Notifications → SMS providers) instead of talking to Twilio directly. Point it at an **n8n
webhook**; n8n dispatches via Twilio and records a `notify.notification` row. Result — ZITADEL owns
the code, n8n owns the wire, and there is still **one delivery chokepoint + one Twilio account**.
This is the exact SMS analogue of the email **return-code** trick (`zitadel-codes.data.md`).

```
ZITADEL login ceremony (MFA step)
  → generates OTP, applies rate-limit/lockout
  → HTTP SMS provider POST → n8n webhook (notification-webhook-style receiver)
       → Twilio Messages API (dispatch)
       → notify_fn.record_send(channel='sms', template_key='zitadel-otp', …)
```

**Open Question (blocker to verify first):** confirm the **HTTP/webhook SMS provider** exists on
the running ZITADEL version. If ZITADEL only offers **Twilio** as an SMS provider on that version,
the fallback is: ZITADEL keeps its **own Twilio credential** for MFA SMS only (accepting a second
sender for auth codes), while all *non-auth* SMS still flows through n8n. Decide when verified.

### 2. Non-auth SMS — n8n owns it (app-triggered)
Transactional texts (notifications, alerts) and **phone-number verification outside login** (e.g.
verifying a phone on a profile) go through the normal path: app →
`triggerWorkflow("send-notification", { channel:"sms", … })` → Twilio → row. Identical shape to
email; just the `sms` branch of `send-notification`.

## Why not app-owned 2FA?
Rejected (README Considered & rejected): building your own OTP + n8n step-up would re-create
rate-limiting, replay/reuse protection, secret storage, and recovery-code flows that ZITADEL
already does correctly. Not worth the security surface for auth-grade step-up. App-owned OTP is
acceptable **only** for non-auth phone verification, and even there ZITADEL's phone-verification can
be reused.

## Provider

- **Twilio** (Resend is email-only). Also what ZITADEL integrates natively — which is exactly why
  the HTTP-provider → n8n path unifies cleanly.
- **Dev:** no "Mailpit for SMS." Dev SMS uses the **log-sink** provider (D10) — `record_send` writes
  the row, nothing is dispatched. Optionally use Twilio test credentials/magic numbers for a real
  round-trip when needed.

## Env (already stubbed in `infrastructure.md`)
`NOTIFY_SMS_PROVIDER` (`log-sink` | `twilio`), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_FROM_NUMBER`.

## Phase 5+ task sketch
- [ ] Verify ZITADEL HTTP SMS provider availability (blocker).
- [ ] `send-notification`: implement the `sms` branch (log-sink dev, Twilio prod).
- [ ] `notification-webhook`: Twilio status-callback mapping (delivered/undelivered/failed).
- [ ] ZITADEL: enable MFA/login policy; wire HTTP SMS provider → n8n webhook (or the Twilio-direct
      fallback for auth SMS).
- [ ] Non-auth phone-verification flow (app → `triggerWorkflow`).
- [ ] `send-test` page: enable the SMS channel option.
- [ ] Templates: `zitadel-otp`, `sms-test`, plus any transactional SMS keys.
