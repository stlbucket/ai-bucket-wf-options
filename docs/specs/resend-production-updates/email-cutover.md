# email-cutover — technical contract

## Status
Draft — see `README.md` for status, locked decisions, and the phased task list. This file is the
implementation-level detail for that plan.

Transport decision: **Resend over SMTP** (the `Send Email` / `n8n-nodes-base.emailSend` node is
unchanged). Scope: **email only**.

---

## 1. Credential template — `n8n/credentials/fnb-smtp.json.tpl`

### Today (Mailpit-hardwired)
```json
{
  "id": "fnbsmtpmailpit1",
  "name": "fnb-smtp",
  "type": "smtp",
  "data": {
    "user": "",
    "password": "",
    "host": "${NOTIFY_SMTP_HOST}",
    "port": ${NOTIFY_SMTP_PORT},
    "secure": false,
    "disableStartTls": true
  }
}
```
`user`/`password` empty + `secure:false` + `disableStartTls:true` = unauthenticated plaintext,
which only works against Mailpit's `MP_SMTP_AUTH_ACCEPT_ANY` / `MP_SMTP_AUTH_ALLOW_INSECURE`.

### Target (fully env-driven — serves dev **and** prod from one template)
```json
{
  "id": "fnbsmtpmailpit1",
  "name": "fnb-smtp",
  "type": "smtp",
  "data": {
    "user": "${NOTIFY_SMTP_USER}",
    "password": "${NOTIFY_SMTP_PASSWORD}",
    "host": "${NOTIFY_SMTP_HOST}",
    "port": ${NOTIFY_SMTP_PORT},
    "secure": ${NOTIFY_SMTP_SECURE},
    "disableStartTls": ${NOTIFY_SMTP_DISABLE_STARTTLS}
  }
}
```

**Renderer compatibility.** `n8n/scripts/render-credentials.mjs` substitutes `${VAR}` via
`JSON.stringify(value).slice(1, -1)` (JSON-escapes the value). For **quoted** template fields
(`"user": "${NOTIFY_SMTP_USER}"`) this yields a valid JSON string. For **unquoted** fields
(`"secure": ${NOTIFY_SMTP_SECURE}`) it emits the bare token `true`/`false` — valid JSON boolean —
exactly the mechanism `"port": ${NOTIFY_SMTP_PORT}` already relies on. The renderer runs
`JSON.parse(rendered)` as a fail-fast, so a malformed value is caught before n8n imports it.

**Hard requirement:** the renderer `process.exit(1)`s on **any** referenced env var that is
undefined. All four new vars (`NOTIFY_SMTP_USER`, `NOTIFY_SMTP_PASSWORD`, `NOTIFY_SMTP_SECURE`,
`NOTIFY_SMTP_DISABLE_STARTTLS`) must be defined in **every** environment (dev `.env` included) or
the `n8n-import` one-shot dies.

The credential `id` (`fnbsmtpmailpit1`) stays — it is an opaque slug referenced by the `Send Email`
node's `credentials.smtp.id`. Renaming it would force a workflow edit for no functional gain.

---

## 2. Provider label de-hardcode — `n8n/workflows/send-notification.json`

The `Record Sent` and `Record Failed` Postgres nodes pass the 8th positional arg to
`notify_fn.record_send(...)` → the `notify.notification.provider` column. Today it is the literal
`'mailpit'`:

```js
// Record Sent — queryReplacement array, 8th element (today)
'mailpit',
// Record Failed — same
'mailpit',
```

Replace **both** with the existing provider selector:

```js
$env.NOTIFY_EMAIL_PROVIDER,
```

So the send log reflects the actual provider (`resend` in prod, `mailpit` in dev). The
`Record Sms Sink` node's `'log-sink'` literal is **out of scope — leave it**.

**Requires:**
- `NOTIFY_EMAIL_PROVIDER` passed into the `n8n` service env (it is **not** today — only
  `NOTIFY_SMTP_HOST`/`PORT` are).
- Expression env access enabled in n8n (`N8N_BLOCK_ENV_ACCESS_IN_NODE` unset/false). If a
  deployment blocks it, use the Set-node fallback (README Open Question 1).

---

## 3. Env-var inventory

### Already declared in `.env.example`
| Var | Dev value | Role |
|---|---|---|
| `NOTIFY_EMAIL_PROVIDER` | `mailpit` | Provider selector — now also the logged `provider` label. |
| `NOTIFY_SMTP_HOST` | `mailpit` | SMTP host. Prod: `smtp.resend.com`. |
| `NOTIFY_SMTP_PORT` | `1025` | SMTP port. Prod: `465`. |
| `RESEND_API_KEY` | *(blank)* | Under the SMTP decision, this is the **value** pasted into `NOTIFY_SMTP_PASSWORD` in prod. Otherwise unused by the SMTP path. |
| `RESEND_WEBHOOK_SECRET` | *(blank)* | Delivery-webhook signature secret (Phase 3 hardening). |
| `MAILPIT_HOST_PORT` | `8025` | Dev Mailpit web UI. Unchanged. |

### New — add to `.env.example` (dev defaults) + `docker-compose.yml` n8n env
| Var | Dev value | Prod value |
|---|---|---|
| `NOTIFY_SMTP_USER` | `""` | `resend` |
| `NOTIFY_SMTP_PASSWORD` | `""` | *(Resend API key)* |
| `NOTIFY_SMTP_SECURE` | `false` | `true` |
| `NOTIFY_SMTP_DISABLE_STARTTLS` | `true` | `false` |

**Resend SMTP reference:** host `smtp.resend.com`, port `465` (TLS) or `587` (STARTTLS), user
`resend`, password = a Resend API key. With `465` use `secure=true` + `disableStartTls=false`.

---

## 4. docker-compose.yml

- Add the four new `NOTIFY_SMTP_*` vars **and** `NOTIFY_EMAIL_PROVIDER` to the `n8n` service
  `environment:` block, alongside the existing `NOTIFY_SMTP_HOST`/`PORT` (they feed both the
  credential render and the provider-label expression).
- Fix the comment that reads *"Prod swaps email to Resend (HTTP) — this service is dev-only"* to say
  **SMTP** — the locked decision is SMTP, not HTTP.
- The `mailpit` service itself is **unchanged** — it stays the dev-only sink.

## 5. .env.example

- Add the four new `NOTIFY_SMTP_*` vars with dev/Mailpit defaults (table above).
- Fix the two "(HTTP)" comments (lines near `NOTIFY_EMAIL_PROVIDER` and the Resend block) to reflect
  the SMTP transport.

---

## 6. Domain verification (prod prerequisite)

`Send Email` hardcodes `fromEmail: no-reply@function-bucket.net`. Resend will **reject** a send from
an unverified domain, so `function-bucket.net` must be verified in the Resend dashboard (add the SPF
+ DKIM DNS records Resend provides) before the prod cutover. This is a DNS/ops step, not a code
change — track it as a Phase 3 prerequisite.

---

## 7. Delivery webhook (optional Phase 3 hardening)

The `notification-webhook` workflow calls `notify_fn.update_delivery` to advance a row on a
provider delivery event (`delivered`/`bounced`/`opened`), matched by `provider_message_id`. It does
**not** currently verify the caller's signature. For production Resend, harden it to validate the
webhook signature using the pre-declared `RESEND_WEBHOOK_SECRET` (Resend signs with svix-style
headers) so delivery status only advances on authenticated callbacks. Optional — the core send path
works without it; until it lands, delivery-status updates are unauthenticated.

---

## 8. Verification (read-only — after the user restarts the env)

Never rebuild/restart the env yourself (memory `feedback_rebuild_ask_user`) — ask the user, then
verify read-only.

**Dev (Phase 1 + 2, still Mailpit):**
1. `n8n-import` job succeeds — no `missing env var …` or `JSON.parse` failure from
   `render-credentials.mjs`.
2. Trigger a notification (e.g. invite-user flow). Mail appears in Mailpit
   (`http://localhost:${MAILPIT_HOST_PORT}`).
3. `select provider from notify.notification order by created_at desc limit 1;` →
   the `NOTIFY_EMAIL_PROVIDER` value (`mailpit` in dev), **not** a hardcoded literal.

**Prod (Phase 3, Resend):**
1. Sending domain shows **verified** in Resend.
2. A real send reaches the inbox (check Resend dashboard logs for the message id).
3. `notify.notification.provider = 'resend'`; `provider_message_id` is populated.
4. (If Phase 3 hardening landed) a Resend delivery webhook advances the row to `delivered` and an
   unsigned/forged callback is rejected.
