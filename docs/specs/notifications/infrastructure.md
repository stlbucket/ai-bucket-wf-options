# Notifications — Infrastructure

## Status
Draft — fill in all `[FILL IN]` sections before implementing.

Covers the compose + env + provider + ZITADEL wiring that the notification pipeline needs. New
infra footprint is intentionally small: **one new compose service (Mailpit)** plus env vars.

## Mailpit (dev email sink)

Modern MailHog successor: an SMTP server that captures everything + a web UI + a REST API to
assert on messages in tests. **Both n8n's email dispatch and (optionally) ZITADEL point at it in
dev**, so nothing hits a real inbox.

```yaml
  # docker-compose.yml — dev outbound-mail sink; nothing leaves the box.
  mailpit:
    image: axllent/mailpit:latest        # pin a digest before merge (house convention)
    container_name: mailpit
    networks: [fnb-network]
    ports:
      - "8025:8025"                        # web UI (browse captured mail)
      # 1025 = SMTP, internal only (n8n reaches it as mailpit:1025)
    environment:
      MP_MAX_MESSAGES: "500"
      MP_SMTP_AUTH_ACCEPT_ANY: "true"
      MP_SMTP_AUTH_ALLOW_INSECURE: "true"
    volumes:
      - mailpit-data:/data
```
Add `mailpit-data` to the top-level `volumes:`. No healthcheck gate needed — n8n retries sends.

## Dev SMS sink — the "Mailpit for SMS" comparison (D11)

SMS has **no SMTP-style protocol** — providers are HTTP APIs — so a true Mailpit parallel is a
*mock provider endpoint + web inbox + assert API*. Three options were evaluated (2026-07-22):

| Option | Catches the provider call | Web inbox | Assert API | Verdict |
|---|---|---|---|---|
| **Mock-Twilio + UI** — `dgeorgiev/twillio-sms-mock`, `notfoundsam/sms-mock-server` (containers with a browsable, auto-refreshing SMS inbox on their own host port) | ✅ Twilio-shaped HTTP | ✅ | ✅ REST | Truest parallel, but **unofficial small projects** → must pin a digest / vendor (house convention); +1 compose service to own. |
| **Log-sink** (chosen) — `send-notification` sms branch writes `notify.notification`, dispatches nothing; the **SMS-Test page** (`sms-test.ui.md`) renders the captured body as the inbox | ❌ no HTTP round-trip | ◑ in-app page | ✅ query the table | **Zero new infra**, RLS-scoped, already the audit trail; the in-app page *is* the inbox. Trade-off: no Twilio-shaped round-trip (won't catch a malformed provider call — that surfaces first against Twilio test creds / staging). |
| **Prism + Twilio OpenAPI** — `stoplight/prism:4 mock … twilio_api_v2010.json` | ✅ validates request vs. the real contract | ❌ | ◑ response only | Great **CI/contract check**, not a browsable catcher. Kept as an optional CI add-on, not the dev sink. |

Honorable mentions (rejected as the primary): Twilio **test credentials + magic numbers** (real API,
no charge/send, but needs internet + an account and has no capture UI — good for a pre-prod
round-trip), Twilio **dev-phone** (needs a real number), **Beeceptor** (hosted, not offline).

**Decision (D11): log-sink is the dev SMS sink** (confirms the original D10). Rationale: the fnb
posture is "dev catches everything with zero real delivery + a browsable UI"; the log-sink already
delivers the *catch* + *audit trail*, and the **SMS-Test page supplies the browsable UI** in-app, so
a second container earns its keep only if a Twilio-shaped round-trip becomes necessary — at which
point the mock-Twilio-with-UI container is the pre-approved upgrade path (add it behind
`NOTIFY_SMS_PROVIDER=mock-twilio` without touching the schema). Prism is the optional CI contract
check. This keeps the infra footprint at exactly **one dev sink service (Mailpit, email only)**.

## Environment variables

Add to `.env` + `.env.example`:

```bash
# ─── Notifications ────────────────────────────────────────────────────────────
# Channel/provider selection consumed inside the n8n send-notification workflow.
NOTIFY_EMAIL_PROVIDER=mailpit            # dev: mailpit | prod: resend
NOTIFY_SMS_PROVIDER=log-sink             # dev: log-sink (chosen, D11) | mock-twilio (opt-in upgrade) | prod: twilio

# Email — Mailpit (dev)
NOTIFY_SMTP_HOST=mailpit
NOTIFY_SMTP_PORT=1025
NOTIFY_MAIL_FROM="fnb <no-reply@function-bucket.net>"

# Email — Resend (prod)
RESEND_API_KEY=                          # prod only
RESEND_WEBHOOK_SECRET=                   # verify inbound delivery/open/bounce webhooks

# SMS — Twilio (Phase 5+; empty in dev)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# fnb-notify DB writes reuse the n8n_worker credential (already defined for fnb-n8n).
```

n8n reads these from its process env (compose passes them into the `n8n` service). The
`send-notification` workflow branches on `NOTIFY_EMAIL_PROVIDER` / `NOTIFY_SMS_PROVIDER`.

## DB deploy order

`fnb-notify` needs the `n8n_worker` role (defined in `fnb-n8n`), so it deploys **after** it:

```
DEPLOY_PACKAGES="fnb-auth fnb-app fnb-n8n fnb-notify fnb-res fnb-msg fnb-todo \
                 fnb-loc fnb-storage fnb-location-datasets fnb-airports fnb-game"
```
Mirror in `.env` and `.env.example`. (Same "deploy after the worker role exists" lesson as
`fnb-storage` — see the note in `00000000011230_n8n_policies.sql:47-50`.)

## ZITADEL wiring (email codes — D5)

**Return-code mode — ZITADEL gets no SMTP.** When the app creates/initializes a human user via the
ZITADEL management API, it requests the init/verify code be **returned in the API response** rather
than emailed, then enqueues it through `send-notification`. See `zitadel-codes.data.md` for the
call shape. Net effect: ZITADEL's Instance → Notifications → SMTP stays **unconfigured**, and the
`ZITADEL_FIRSTINSTANCE_ORG_HUMAN_EMAIL_VERIFIED: "true"` seed keeps the admin from needing a
verification mail.

> If return-code mode proves awkward for a given flow, the fallback (Considered & rejected in the
> README) is to configure ZITADEL SMTP at `mailpit:1025` (dev) / Resend (prod) and use ZITADEL's
> built-in templates — accepting a second sender.

## ZITADEL wiring (SMS / 2FA — Phase 5+, `sms-2fa.future.md`)

For auth-grade SMS 2FA, ZITADEL owns the MFA ceremony but its **SMS delivery** is pointed at an
**n8n webhook** via ZITADEL's generic **HTTP SMS provider** (Instance → Notifications → SMS
providers). ZITADEL POSTs the message + recipient to the `notification-webhook`-style receiver;
n8n dispatches via Twilio and records the row. **Open Question:** confirm the HTTP SMS provider
exists on the running ZITADEL version (vs. Twilio-only), which decides whether n8n owns the SMS
wire or ZITADEL keeps its own Twilio account for MFA.

## n8n webhook exposure (resolved)

n8n has **no Caddy route** — it runs on **its own host port** (Caddyfile note; R22). So:

- **fnb → n8n** (the `triggerWorkflow` registry + the send path) is internal:
  `${N8N_INTERNAL_URL}/webhook/<key>` (`N8N_INTERNAL_URL=http://n8n:5678`) with the shared
  `X-Fnb-Webhook-Secret` header (`N8N_WEBHOOK_SECRET`). This is the existing invariant — the
  `send-notification` entry just adds a `WORKFLOW_REGISTRY` key.
- **provider → n8n** (delivery webhooks) must reach n8n's **own host-port ingress** (dev: n8n's
  published port; prod: whatever public URL fronts n8n). Not Caddy. In **dev** this is largely
  moot — Resend can't call `localhost`; delivery-event testing waits for a reachable env.

## Provider webhooks (delivery events)

- **Resend** → POST to the `notification-webhook` n8n Webhook Trigger (`delivered`/`opened`/
  `bounced`) at n8n's own ingress. Verify with `RESEND_WEBHOOK_SECRET`.
- **Twilio** (Phase 5+) → status-callback URL → same `notification-webhook` workflow, sms branch.

## Checklist
- [ ] `mailpit` service + `mailpit-data` volume in `docker-compose.yml`.
- [ ] `NOTIFY_*` / `RESEND_*` / `TWILIO_*` in `.env` + `.env.example`.
- [ ] `fnb-notify` inserted after `fnb-n8n` in `DEPLOY_PACKAGES` (both files).
- [ ] Confirm Caddy exposes an n8n webhook path for provider callbacks (`[FILL IN]`).
- [ ] ZITADEL SMTP left unconfigured (return-code mode); documented in the seed notes.
