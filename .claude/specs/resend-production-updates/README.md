> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the Implementation Task List
> below, then executes it.

# resend-production-updates

## Status
Draft — production email cutover from the dev Mailpit sink to Resend (over SMTP). No `[FILL IN]`
markers remain; see **Remaining Open Questions** for the two deferred decisions (both have a
recommended default and do not block planning).

## Purpose

The `send-notification` n8n workflow is the **sole** outbound-email dispatcher — every other email
workflow (`invite-user`, `forgot-password`, `send-deep-link`, `phone-verification`) POSTs to its
internal webhook rather than sending mail itself. Today its `Send Email` node dispatches over SMTP
to **Mailpit**, the dev-only capture sink. Three things are Mailpit-flavored and must change before
production email works:

1. **The SMTP credential template** (`n8n/credentials/fnb-smtp.json.tpl`) is hardwired for
   *unauthenticated, plaintext* SMTP (`user:""`, `password:""`, `secure:false`,
   `disableStartTls:true`) — that is exactly Mailpit's `MP_SMTP_AUTH_ACCEPT_ANY`. Resend's SMTP
   endpoint requires **auth + TLS**, so pointing only `NOTIFY_SMTP_HOST`/`PORT` at Resend fails auth.
2. **The `'mailpit'` provider label** is a hardcoded literal in the `Record Sent` / `Record Failed`
   Postgres nodes (the 8th arg to `notify_fn.record_send`, → `notify.notification.provider`). Purely
   cosmetic, but every send is logged as `mailpit` even when Resend delivered it — a misleading
   audit trail.
3. **The sending domain** (`function-bucket.net`, from `fromEmail: no-reply@function-bucket.net`)
   must be verified in Resend (SPF/DKIM DNS) or Resend rejects the send.

**Decision:** send via **Resend over SMTP** — the `Send Email` (`n8n-nodes-base.emailSend`) node is
**unchanged**; only the credential (env-driven) and the provider label change. This is the smallest
viable cutover and keeps the workflow provider-neutral.

Scope is **email only**. The `Record Sms Sink` (`log-sink`) branch stays a dev sink — a real SMS
provider is a separate future spec.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Resend transport | **SMTP** (keep `emailSend` node) | Drop-in: only the credential changes. No workflow surgery, no `messageId`-extraction rewrite. Resend's SMTP is a first-class endpoint (`smtp.resend.com`, user `resend`, password = API key). |
| Credential template shape | **Fully env-driven** (`user`/`password`/`secure`/`disableStartTls` all `${…}`) | One template serves both dev (Mailpit: empty auth, plaintext) and prod (Resend: auth + TLS) — no branching. The existing renderer already substitutes bare `${VAR}` for the boolean/number fields (same mechanism as `port`). |
| Provider label source | **Reuse `NOTIFY_EMAIL_PROVIDER`** (already in `.env.example`) | Do not invent a new var. De-hardcode `'mailpit'` → the existing provider selector so the log reflects reality. |
| Secret plumbing | Resend API key → **`NOTIFY_SMTP_PASSWORD`** (provider-neutral slot) | Keeps the credential template generic. Under the SMTP decision the pre-declared `RESEND_API_KEY` placeholder is only the *value* you paste into `NOTIFY_SMTP_PASSWORD`. |
| Scope | **Email / Resend only** | SMS `Record Sms Sink` stays `log-sink`; real SMS provider is a separate spec. |
| Docker-compose / `.env.example` wording | Correct "Resend **(HTTP)**" → **SMTP** | The compose + `.env.example` comments say "Resend (HTTP)", contradicting the locked SMTP decision. Keep docs accurate (R21 spirit). |

## Files in this spec

| File | Purpose |
|---|---|
| `README.md` | This index — status, locked decisions, task list, open questions. |
| `email-cutover.md` | The technical contract: credential-template diff, provider-label de-hardcode, env-var inventory, docker-compose + `.env.example` changes, domain verification, and read-only verification steps. Includes the optional Phase 3 delivery-webhook hardening. |

## Files touched at implementation (not part of this spec dir)

| Path | Change |
|---|---|
| `n8n/credentials/fnb-smtp.json.tpl` | Add env-driven `user`/`password`/`secure`/`disableStartTls`. |
| `n8n/workflows/send-notification.json` | `Record Sent` + `Record Failed`: `'mailpit'` literal → `$env.NOTIFY_EMAIL_PROVIDER`. `Send Email` node **unchanged**. |
| `docker-compose.yml` | Pass `NOTIFY_SMTP_USER/PASSWORD/SECURE/DISABLE_STARTTLS` + `NOTIFY_EMAIL_PROVIDER` into the `n8n` service env; fix the "Resend (HTTP)" comment; keep the `mailpit` service (dev-only, unchanged). |
| `.env.example` | Add the four new `NOTIFY_SMTP_*` vars with **dev/Mailpit** defaults; fix the "(HTTP)" comment. |
| `infra/env/render-env.mjs` (+ tfvars) | Provide the **prod/Resend** values (`smtp.resend.com`, `465`, `resend`, the API key, `secure=true`, `disableStartTls=false`, `NOTIFY_EMAIL_PROVIDER=resend`). Exact keys → route through `terraform-export`. |
| `.claude/specs/notifications/` (`infrastructure.md`, `send-notification.workflow.md`) | Mode 3 sync once implemented: the email provider is Resend-over-SMTP, provider label is env-driven. |

## Implementation Task List

### Phase 1 — Env-driven credential (dev stays green)
- [ ] Rewrite `fnb-smtp.json.tpl` `data` block to be fully env-driven: `user:"${NOTIFY_SMTP_USER}"`,
      `password:"${NOTIFY_SMTP_PASSWORD}"`, `host`/`port` (unchanged), `secure:${NOTIFY_SMTP_SECURE}`,
      `disableStartTls:${NOTIFY_SMTP_DISABLE_STARTTLS}`.
- [ ] Add the four new vars to `.env.example` with **dev/Mailpit defaults** (`USER=""`,
      `PASSWORD=""`, `SECURE=false`, `DISABLE_STARTTLS=true`); fix the "Resend (HTTP)" → SMTP comment.
- [ ] Pass the four new vars into the `n8n` service env block in `docker-compose.yml` (next to the
      existing `NOTIFY_SMTP_HOST`/`PORT`). `render-credentials.mjs` hard-fails on any undefined
      referenced var, so **all four must be present** or the import job dies.
- [ ] Verify (read-only, after the user restarts): dev mail still lands in Mailpit; the rendered
      credential parses (the renderer's `JSON.parse` fail-fast) and mail is captured.

### Phase 2 — Provider label de-hardcode
- [ ] In `send-notification.json`, replace the `'mailpit'` literal in **both** the `Record Sent`
      and `Record Failed` `queryReplacement` arrays with `$env.NOTIFY_EMAIL_PROVIDER`.
- [ ] Ensure `NOTIFY_EMAIL_PROVIDER` is passed into the `n8n` service env (it is **not** today) and
      that n8n expression env access is enabled (`N8N_BLOCK_ENV_ACCESS_IN_NODE` unset/false) — see
      Open Question 1 for the Set-node fallback if env access is locked down.
- [ ] Verify: a dev send logs `provider = 'mailpit'` (or whatever `NOTIFY_EMAIL_PROVIDER` is set to)
      in `notify.notification`, not the hardcoded literal.

### Phase 3 — Prod cutover (Resend) + hardening
- [ ] Verify `function-bucket.net` in Resend (SPF + DKIM DNS records) so `no-reply@function-bucket.net`
      is an allowed sender — **prerequisite**; sends bounce without it.
- [ ] Wire prod values via `infra/env/render-env.mjs` (+ tfvars): `NOTIFY_SMTP_HOST=smtp.resend.com`,
      `NOTIFY_SMTP_PORT=465`, `NOTIFY_SMTP_USER=resend`, `NOTIFY_SMTP_PASSWORD=<Resend API key>`,
      `NOTIFY_SMTP_SECURE=true`, `NOTIFY_SMTP_DISABLE_STARTTLS=false`, `NOTIFY_EMAIL_PROVIDER=resend`.
      (Route the exact terraform/tfvars keys through `terraform-export`.)
- [ ] **(Optional hardening)** Wire the `notification-webhook` workflow to verify Resend's
      delivery-status webhook signature with the pre-declared `RESEND_WEBHOOK_SECRET` (svix headers),
      so `update_delivery` only advances on authenticated callbacks. See Open Question 2.

## Remaining Open Questions

- [ ] **1 — Provider label mechanism: `$env` expression vs Set-node constant.** Recommended:
      `$env.NOTIFY_EMAIL_PROVIDER` (DRY with the existing var). If the deployment locks down
      expression env access (`N8N_BLOCK_ENV_ACCESS_IN_NODE=true`), fall back to a workflow-level Set
      node that publishes the provider string once, referenced by both Record nodes. Decide at
      implementation against the actual n8n env-access setting.
- [ ] **2 — Delivery-webhook signature verification scope.** The `notification-webhook` workflow
      currently does **not** validate Resend's webhook signature (no `RESEND_WEBHOOK_SECRET`/svix
      check today). Include it as Phase 3 hardening, or split into its own follow-up spec?
      Recommended: keep as an **optional** Phase 3 item — the core email cutover works without it,
      but production `delivered`/`bounced` status is unauthenticated until it lands.

## Considered & rejected

| Option | Why rejected |
|---|---|
| **Resend over HTTP API** (replace `Send Email` with an HTTP Request node) | Requires workflow surgery + rewriting how `Record Sent` reads the provider message id (`$json.id` vs `$json.messageId`). The compose comment's "(HTTP)" wording implied this, but SMTP is a supported Resend endpoint and far less invasive. Rejected in favor of the drop-in SMTP path. |
| **Branch the credential template per environment** (separate dev/prod `.tpl`) | A single fully env-driven template covers both; two templates duplicate the credential and risk drift. |
| **Invent a new `NOTIFY_PROVIDER` var for the label** | `NOTIFY_EMAIL_PROVIDER` already exists in `.env.example` for exactly this selector — reuse it. |
| **Rename the credential id `fnbsmtpmailpit1`** | The id is opaque and referenced by the `Send Email` node; renaming forces a workflow edit for zero functional gain. Leave it; only the Mailpit *behavior* changes, not the slug. |
| **Bundle a real SMS provider** | Out of the scoped email-only cutover; the `log-sink` SMS branch is untouched. Separate future spec. |
