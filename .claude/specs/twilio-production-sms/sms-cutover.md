# Twilio SMS cutover — dispatch contract

## Status
Draft — see `README.md` for locked decisions and the task list. This file is the technical
contract for the `send-notification` SMS branch, the `fnb-twilio` credential, and the env/compose
plumbing. Callbacks are `status-callbacks.md`.

## Current state (what changes)

`send-notification.json` today:

```
Webhook → If Email ──true──► Render → Send Email → Record Sent / Record Failed
                   └─false──► Record Sms Sink        ← the entire SMS "branch"
```

`Record Sms Sink` writes `notify_fn.record_send(channel, templateKey, to, subject, vars, …,
'log-sink', '', executionId, 'sent', '{}')` — provider literal, **no rendered body**, no
dispatch. The SMS-Test inbox compensates by reading `payload.body` (free-text sends) or
`payload.code` (OTP) out of the raw vars (`apps/tenant-app/app/pages/site-admin/sms-test.vue:26-29`).

## Target node flow (SMS branch only — email branch untouched)

```
If Email (false)
  → Render Sms (Code): templateKey + vars → { body }
  → If Twilio ($env.NOTIFY_SMS_PROVIDER === 'twilio')
      ├─ true:  Send Sms (Twilio node, cred fnb-twilio,
      │           From: $env.TWILIO_FROM_NUMBER, To: body.to, Message: rendered body,
      │           StatusCallback: see status-callbacks.md; onError: continueErrorOutput)
      │           ├─ main  → Record Sms Sent   (status 'sent',   provider $env.NOTIFY_SMS_PROVIDER,
      │           │                             providerMessageId $json.sid)
      │           └─ error → Record Sms Failed (status 'failed', error populated)
      └─ false: Record Sms Sink (unchanged: provider 'log-sink', status 'sent', no dispatch)
```

All three record nodes now persist `payload = { ...vars, body: <rendered> }` — a strict superset
of today's `vars`, so the SMS-Test inbox keeps working and starts showing the exact rendered
text. Error workflow stays `error-handler` (workflow `settings.errorWorkflow`, already set).

### `Render Sms` (Code node, runOnceForAllItems)

The SMS analog of the email `Render` node — plain text, no HTML. Template keys:

| Key | Body |
|---|---|
| `phone-verify` | `fnb: your phone verification code is {code}. It expires in 10 minutes.` (TTL fact: `notify_prefs_fn.sql` — `interval '10 minutes'`) |
| `otp-login` | `fnb: your login code is {code}. It expires in 10 minutes.` (parity with the email template key; used if/when the OTP deep-link share sends SMS) |
| *fallback* | `vars.body ?? vars.text ?? templateKey` (free-text — what the SMS-Test page sends as `vars.body`) |

Output: `[{ json: { body } }]`. Templates stay inline (same v1 call as email; a `notify.template`
table remains a notifications-spec open question).

### `If Twilio`

Single string-equals condition: `={{ $env.NOTIFY_SMS_PROVIDER }}` equals `twilio`. Anything else
(dev `log-sink`, a future `mock-twilio`) falls through to the sink — the workflow JSON is
identical in every environment (R22). `$env` access is already enabled
(`N8N_BLOCK_ENV_ACCESS_IN_NODE: "false"` in both compose files — the reaper precedent).

### `Send Sms` (Twilio node)

- `n8n-nodes-base.twilio`, resource **SMS**, operation **Send**.
- Credential: `fnb-twilio` (below). From: `={{ $env.TWILIO_FROM_NUMBER }}`. To:
  `={{ $('Webhook').item.json.body.to }}`. Message: `={{ $('Render Sms').item.json.body }}`.
- **Error output wired** (`onError: continueErrorOutput`) → `Record Sms Failed`, exactly like
  `Send Email` → `Record Failed`.
- Success output exposes the created message resource — `providerMessageId` is **`$json.sid`**
  (the `SM…` Message SID; the email path's `$json.messageId` analog).
- **Resolved (README OQ1):** the pinned 2.30.7 node's SMS→Send `options` collection includes
  `statusCallback` (verified in the image source) — the Twilio node handles Phase 4's callback
  URL directly; the HTTP-Request fallback is retired.

### Record nodes

Same `notify_fn.record_send` call shape as today (12 args). Deltas only:

| Node | provider (arg 8) | providerMessageId (arg 9) | status (arg 11) | payload (arg 5) |
|---|---|---|---|---|
| `Record Sms Sent` (new) | `$env.NOTIFY_SMS_PROVIDER` | `$json.sid` | `'sent'` | `JSON.stringify({ ...vars, body })` |
| `Record Sms Failed` (new) | `$env.NOTIFY_SMS_PROVIDER` | `''` | `'failed'` | same; `error` (arg 12) = the node error json |
| `Record Sms Sink` | `'log-sink'` (literal stays — it names *this path*, not the env selector) | `''` | `'sent'` | same (gains `body`) |

(The email branch's hardcoded `'mailpit'` provider label is a known separate item —
`resend-production-updates` Phase 2 — not silently absorbed here.)

## `fnb-twilio` credential template

`n8n/credentials/fnb-twilio.json.tpl` (rendered by `n8n/scripts/render-credentials.mjs`, which
JSON-escapes values and fails on **undefined** — empty strings are fine, so dev renders a blank
credential that the never-executed Twilio node ignores):

```json
{
  "id": "fnbtwilio1",
  "name": "fnb-twilio",
  "type": "twilioApi",
  "data": {
    "authType": "authToken",
    "accountSid": "${TWILIO_ACCOUNT_SID}",
    "authToken": "${TWILIO_AUTH_TOKEN}"
  }
}
```

Stable id (house convention — sqitch/seed analog, overwrites in place on every import).

## Env-var inventory

`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` and
`NOTIFY_SMS_PROVIDER=log-sink` already exist in `.env.example` — **no new var names**; this spec
wires them through. Update the `.env.example` comment ("Phase 5+ SMS" → point at this spec).

| Var | Consumed by | Dev value | Prod value |
|---|---|---|---|
| `NOTIFY_SMS_PROVIDER` | `n8n` service env → `If Twilio` + record labels | `log-sink` | `twilio` |
| `TWILIO_ACCOUNT_SID` | `n8n-import` env → credential render | *(blank)* | secret |
| `TWILIO_AUTH_TOKEN` | `n8n-import` env (credential) **and** `n8n` env (signature check, Phase 4) | *(blank)* | secret |
| `TWILIO_FROM_NUMBER` | `n8n` service env → `Send Sms` From | *(blank)* | `+1…` (E.164) |

### Dev `docker-compose.yml`

- `n8n-import` environment (next to the `NOTIFY_SMTP_*` block):
  `TWILIO_ACCOUNT_SID: "${TWILIO_ACCOUNT_SID:-}"`, `TWILIO_AUTH_TOKEN: "${TWILIO_AUTH_TOKEN:-}"`
  — blank-tolerant, **not** `:?` (dev never dispatches; the renderer only dies on undefined).
- `n8n` environment: `NOTIFY_SMS_PROVIDER: "${NOTIFY_SMS_PROVIDER:?}"`,
  `TWILIO_FROM_NUMBER: "${TWILIO_FROM_NUMBER:-}"`, `TWILIO_AUTH_TOKEN: "${TWILIO_AUTH_TOKEN:-}"`;
  extend `NODE_FUNCTION_ALLOW_BUILTIN: "fs,http,https"` → `"fs,http,https,crypto"` (Phase 4's
  signature Code node).

### Prod `infra/compose/docker-compose.prod.yml`

Same five keys in the same two services, all `:?`-required (values come from the rendered box
`.env`), plus the same `NODE_FUNCTION_ALLOW_BUILTIN` extension.

### `infra/env/.env.prod.tpl`

Replace the "SMS stays log-sink (dispatch is Phase 5+ …)" comment block with:

```bash
# SMS = Twilio (spec .claude/specs/twilio-production-sms/). The fnb-twilio n8n
# credential + the send-notification sms branch render from these.
NOTIFY_SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
TWILIO_FROM_NUMBER=${TWILIO_FROM_NUMBER}
```

(`render-env.mjs` fails loud on missing/empty values — the three GH secrets are hard
prerequisites of the first post-cutover deploy.)

### `.github/workflows/deploy.yml` + `infra/README.md`

Add the three repo secrets to the render-env step's `env:` block (next to
`RESEND_API_KEY`, `deploy.yml:121`); bump the secrets checklist count in `infra/README.md`
(22 → 25) and list them.

## Verification

**Dev (Phase 1–2, read-only after the user rebuilds):**
- `n8n-import` logs: six credentials rendered (fnb-twilio included), all workflows imported.
- SMS-Test page send → `notify.notification` row `sms`/`log-sink`/`sent`, inbox shows the
  **rendered** body; phone-verification round-trip (request → read code in inbox → verify)
  still green. Mail path untouched (Mailpit).

**Prod (Phase 3):**
- Deploy is env-only (same image tag) per `deploy.README.md` gotcha #2 — re-render + `up -d`
  + n8n restart.
- SMS-Test send to a real phone → text arrives; row `provider='twilio'`,
  `provider_message_id` = `SM…`; a deliberate bad number → `failed` row with the Twilio error.
- Phone verification completes from a real handset; SMS toggle unlocks on `/auth/profile`.
