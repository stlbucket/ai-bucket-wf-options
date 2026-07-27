# Twilio delivery status callbacks — `notification-webhook` contract

## Status
Draft — see `README.md`. Phase 4 of the cutover: authenticated Twilio delivery statuses flowing
into `notify.notification` via the existing `notification-webhook` workflow.

## Why

Without callbacks, Twilio rows stop at `sent` — "Twilio accepted it", not "the handset got it".
Carrier filtering (the A2P failure mode) is only visible via the `delivered`/`undelivered`
callback statuses. Prod n8n is publicly reachable behind Caddy TLS (`https://n8n.<domain>` —
`deploy.yml` health-verifies it), so unlike dev, callbacks actually arrive.

## Wiring the callback URL

`StatusCallback=https://n8n.<domain>/webhook/notification-webhook` is set **per message** on the
send via the Twilio node's `options.statusCallback` (confirmed present on the pinned 2.30.7
image — README OQ1). Per-message beats console config: it survives number changes and needs no
Messaging Service. The URL is built from env — reuse the prod `WEBHOOK_URL`/`N8N_HOST` value the
compose file already derives rather than inventing a new var (exact expression at
implementation; dev never sets it because the sink branch never dispatches).

Twilio POSTs `application/x-www-form-urlencoded` (n8n's Webhook node parses it into
`$json.body`): `MessageSid`, `MessageStatus` ∈ `queued|sending|sent|delivered|undelivered|failed`,
`ErrorCode` (on failure), plus `To`/`From`/`AccountSid`.

## Current workflow (what changes)

```
Webhook (notification-webhook, responseMode onReceived, NO auth today)
  → Map Status (Resend email.* map; providerMessageId already falls back to body.MessageSid)
  → Update Delivery (notify_fn.update_delivery(providerMessageId, status, error))
```

Target:

```
Webhook
  → Verify Twilio Signature (Code; only when body.MessageSid present — Resend events pass through)
  → Map Status (+ Twilio MessageStatus map)
  → Update Delivery (unchanged)
```

### `Map Status` — add the Twilio map

`providerMessageId` (`m1`) already reads `$json.body?.MessageSid || …` — unchanged. `status`
(`m2`) becomes: when `body.MessageSid` is present, map `MessageStatus`:

| Twilio `MessageStatus` | `notify.notification_status` |
|---|---|
| `delivered` | `delivered` |
| `undelivered`, `failed` | `failed` (with `{ errorCode: ErrorCode }` in `error`) |
| `queued`, `sending`, `sent`, `accepted` | `sent` |

otherwise keep the existing Resend `email.*` map. `error` (`m3`) gains the `ErrorCode` case.

**Downgrade guard: already in place** — `notify_fn.update_delivery` only advances when
`status_rank(_status) > status_rank(status)`
(`db/fnb-notify/deploy/00000000011250_notify_fn.sql:91`), so out-of-order callbacks (`sent`
after `delivered`) are no-ops. **Zero DB changes in this spec.**

### `Verify Twilio Signature` (Code node)

Twilio signs every callback: `X-Twilio-Signature = base64(HMAC-SHA1(authToken, url + sortedParams))`
where `sortedParams` = each POST param's `name + value`, concatenated in alphabetical key order,
appended to the **exact URL Twilio requested**.

- Gate: only runs the check when `$json.body?.MessageSid` is present (Twilio-shaped). Resend
  events skip through untouched — their svix verification remains
  `resend-production-updates` OQ2, not absorbed here.
- Rebuild the URL from the request: `(headers['x-forwarded-proto'] ?? 'https') + '://' +
  headers.host + '/webhook/notification-webhook'` — workable per README OQ3: prod Caddy is a
  bare `reverse_proxy n8n:5678` under `n8n.{$DOMAIN}` (`infra/docker/Caddyfile:75-77`), which
  preserves `Host` and sets `X-Forwarded-Proto`. Sanity-check with one logged callback during
  Phase 4 verification.
- Compute with `require('crypto')` — hence `NODE_FUNCTION_ALLOW_BUILTIN` gains `crypto`
  (`sms-cutover.md` §compose). **Must be the bare name, not `node:crypto`:** with task runners
  enabled (`N8N_RUNNERS_ENABLED=true`), the runner's require-resolver checks the *literal*
  request string against the allowlist Set — `require('node:crypto')` fails
  `Module 'node:crypto' is disallowed` even with `crypto` allowed (verified in dev
  2026-07-27). Token: `$env.TWILIO_AUTH_TOKEN` (already in the n8n service env for Phase 1).
  Compare constant-time (`crypto.timingSafeEqual`). In dev the token is blank, so any
  Twilio-shaped callback fails fast with `TWILIO_AUTH_TOKEN missing` — correct: dev never
  receives genuine Twilio callbacks.
- Mismatch → **stop the execution** (throw): no `Update Delivery`, and the failure lands in the
  `error-handler` workflow log (visibility into forgery attempts / URL-reconstruction bugs).

Header-auth on the Webhook node itself is *not* an option — Twilio can't send custom headers;
signature verification is the Twilio-sanctioned mechanism.

## Verification

- Prod: send an SMS to a real handset → row advances `sent → delivered` (watch
  `notify.notification.status` + `delivered_at`).
- Send to a Twilio magic **undeliverable** number (or an unreachable landline) → `failed` with
  `ErrorCode` in `error`.
- Forge a callback (`curl` the public webhook with a plausible body, wrong/absent signature) →
  execution errors, row untouched.
- Resend regression: an email delivery event still advances email rows (the gate must not
  swallow non-Twilio payloads).
