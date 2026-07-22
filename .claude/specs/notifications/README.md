# Notifications (`fnb-notify`) — Spec Index

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below, then
> executes it.

## Status

**Draft — fill in all `[FILL IN]` sections before implementing.** Forward-looking (Mode 2).
Locked decisions captured with the user 2026-07-22 (see the four-question round + follow-up
thoughts). Phases 1–4 (email + invitation + test page) are v1; SMS/2FA is deferred (Phase 5+,
`sms-2fa.future.md`).

## Purpose

A single, multi-channel **notification** capability for the whole stack. Every outbound message —
email now, SMS later — flows through **one n8n workflow** (`send-notification`) and is recorded in
**one DB table** (`notify.notification`, in the new `fnb-notify` sqitch package). n8n is the sole
dispatcher (R22); the app and the DB never talk to a provider directly — they enqueue a
notification via the existing `triggerWorkflow` registry and n8n renders + sends + records.

This gives the stack:

- **One sender / one provider config** — swap Resend/Twilio/Mailpit in one place.
- **One audit trail** — `notify.notification` is the outbox + delivery log (sent, failed,
  delivered, opened, bounced), queryable via PostGraphile, RLS-scoped like `n8n.workflow_run`.
- **One template store** — template keys resolve to bodies inside the workflow.
- **A clean IdP split** — ZITADEL owns identity/step-up *logic*; n8n owns *delivery* of its codes
  (email via **return-code mode**, SMS later via ZITADEL's **HTTP SMS provider → n8n webhook**).

### The email problem this solves (context)

Today ZITADEL sends **zero** email (no SMTP configured; users are seeded verified; invites are
lazy — a `resident` row is created `invited` and linked by email-match on first OIDC login,
`zitadel-login-pattern.md:46,191`). There is no mail catcher and no notification log. v1 turns the
lazy invite into an actual email and establishes the pipeline everything else rides on.

## Locked decisions

| # | Area | Choice | Why |
|---|------|--------|-----|
| D1 | Dispatcher | **n8n `send-notification` workflow** — single chokepoint via the `triggerWorkflow` registry | R22 (n8n is the sole engine); centralizes templates/retries/provider-swap; free run log |
| D2 | DB package | **New `fnb-notify`** (`notify` / `notify_fn` / `notify_api`), deployed **after `fnb-n8n`** | One-concern-per-package house style; needs the `n8n_worker` role for writes (same lesson as storage) |
| D3 | Outbox/log | **`notify.notification`** table — channel + status + provider ids + template key + payload + delivery fields | One audit trail; RLS-scoped super-admin reads (mirrors `n8n.workflow_run`) |
| D4 | Prod email provider | **Resend** (dev = **Mailpit** sink) | Modern DX, open/click webhooks; dev catches mail with zero real delivery |
| D5 | ZITADEL email codes | **Return-code mode → n8n** — ZITADEL never gets SMTP | Single sender, one template store; ZITADEL stays a pure identity engine |
| D6 | v1 scope | **User invitation email only** | The canonical first sender; other triggers documented-but-deferred |
| D7 | Test harness | **Site-admin `send-test` page** (Phase 4) — compose + send arbitrary notification | Manual pipeline verification; `p:app-admin-super` gated |
| D8 | SMS channel | **`fnb-notify` is multi-channel from day one** (schema has `channel`); SMS **dispatch** is Phase 5+ | Avoids a migration later; SMS provider = **Twilio** (Resend is email-only) |
| D9 | SMS + 2FA | **ZITADEL owns the MFA ceremony**; SMS delivery pointed at an **n8n webhook** (HTTP SMS provider) | Don't rebuild IdP-grade step-up; keep n8n the single delivery chokepoint (`sms-2fa.future.md`) |
| D10 | Dev SMS | **Log-only sink channel** (record to `notify.notification`, don't dispatch) | No "Mailpit for SMS"; keeps dev SMS observable without a carrier |

## Files in this spec

| File | Covers |
|------|--------|
| `_shared.data.md` | `fnb-notify` DB module — `notify.notification` schema, channel/status enums, RLS, `n8n_worker` writes, permissions, fnb-types |
| `infrastructure.md` | **Mailpit** compose service; env vars (Resend/Twilio/Mailpit); `DEPLOY_PACKAGES` order; ZITADEL return-code + HTTP-SMS wiring |
| `send-notification.workflow.md` | The n8n dispatch workflow — `triggerWorkflow` registry entry, payload contract, channel routing, template render, provider call, row write |
| `notification-webhook.workflow.md` | The n8n callback workflow — Resend/Twilio delivery events → update `notify.notification` (delivered/opened/bounced/failed) |
| `invitation-email.data.md` | **v1 sender** — hook the residency-invite path → enqueue `user-invitation` email |
| `zitadel-codes.data.md` | ZITADEL **return-code** wiring — request init/verify codes via API, dispatch through `send-notification` |
| `send-test.ui.md` | **Site-admin** `send-test` page — compose form (channel/to/template/body), send, result toast |
| `send-test.data.md` | Test page data — composable → `triggerWorkflow('send-notification', …)` carve-out; recent-sends list |
| `sms-2fa.future.md` | **(future)** SMS channel + 2FA — ZITADEL MFA ownership, HTTP-SMS-provider → n8n webhook, Twilio, phone verification |

## Implementation Task List

Phased build order; each phase is independently verifiable.

### Phase 1 — DB module `fnb-notify` (`_shared.data.md`)
- [ ] Sqitch package `db/fnb-notify/` — schemas `notify` / `notify_fn` / `notify_api`; enums
      `notify.notification_channel` (`email`, `sms`) + `notify.notification_status`
      (`queued`, `sent`, `delivered`, `opened`, `bounced`, `failed`); `notify.notification` table
      + indexes; `notify_fn.record_send` / `notify_fn.update_delivery` (SECURITY DEFINER);
      `notify_api` read surface; grants + RLS + `n8n_worker` execute grants.
- [ ] Register `fnb-notify` in `DEPLOY_PACKAGES` (`.env` / `.env.example`) **after `fnb-n8n`**.
- [ ] Matching `revert/` + `verify/`; **no `git` during sqitch sessions**.

### Phase 2 — Dispatch + callback workflows (`send-notification.workflow.md`, `notification-webhook.workflow.md`)
- [ ] `n8n/workflows/send-notification.json` — Webhook Trigger → validate → route by `channel`
      (email=Resend/Mailpit; sms=log-sink for now) → render template → send → `record_send`.
- [ ] `n8n/workflows/notification-webhook.json` — Webhook Trigger for Resend events → map →
      `update_delivery`.
- [ ] Register both in `n8n-import` and the `triggerWorkflow` registry.
- [ ] Verify: a manual `triggerWorkflow` enqueue produces a Mailpit message + a `queued→sent` row.

### Phase 3 — Invitation email (`invitation-email.data.md`)  ← v1 goal
- [ ] Hook the residency-invite path (`[FILL IN]` — confirm the fnb-app invite fn) to enqueue a
      `user-invitation` email via `triggerWorkflow`.
- [ ] Template: "you've been invited" + login CTA (deep link to `/auth`).
- [ ] Verify: inviting a resident lands a message in Mailpit and a `notify.notification` row.

### Phase 4 — Site-admin test page (`send-test.ui.md`, `send-test.data.md`)
- [ ] `send-test` page in tenant-app site-admin (channel/to/template/free-body form), gated
      `p:app-admin-super`.
- [ ] Composable posts to a `withClaims` carve-out route → `triggerWorkflow('send-notification')`.
- [ ] Recent-sends list from `notify_api` (RLS super-admin reads).
- [ ] Nav entry registered in the DB (R14) under `site-admin`.
- [ ] Verify: send a test email → Mailpit + row + result toast.

### Phase 5+ — SMS channel + 2FA (`sms-2fa.future.md`)  ← deferred
- [ ] Twilio provider in `send-notification` (sms branch); dev stays log-sink.
- [ ] ZITADEL: enable MFA/login policy; point SMS delivery at the n8n **HTTP SMS provider** webhook
      (verify availability on the running ZITADEL version — Open Question).
- [ ] Non-auth SMS + phone-verification path (app → `triggerWorkflow`, same as email).
- [ ] `send-test` page gains the SMS channel.

## Remaining Open Questions

- **Invite fn hook point** — exact fnb-app function/trigger that marks a resident `invited`
  (`[FILL IN]`). Enqueue there vs. a DB `AFTER INSERT` trigger calling the webhook.
- **ZITADEL HTTP SMS provider availability** — confirm the generic HTTP/webhook SMS provider
  exists on the running ZITADEL version (vs. Twilio-only). Determines whether D9's "n8n owns the
  wire" holds for auth-grade SMS, or whether ZITADEL keeps its own Twilio account for MFA only.
- **`triggerWorkflow` registry location** — the exact file the new `send-notification` entry lands
  in (`[FILL IN]` — confirm from the n8n-parallel-engine spec).
- **Template storage** — inline in the workflow (v1) vs. a `notify.template` table later (i18n /
  admin-editable). v1 = inline.
- **Retry/backoff** — rely on n8n's per-node retry (v1) vs. a reaper over `queued`/`failed` rows.
- **Resend inbound / reply handling** — out of scope for v1; revisit if reply-to-ticket is wanted
  (would favor Postmark; recorded in Considered & rejected).
- **PII/retention** — how long `payload` (recipient + rendered body) is retained; redaction policy.

## Considered & rejected

- **PostHog for email analytics** — self-hosting pulls in ClickHouse; too heavy for email-only.
  The `notify.notification` table + provider webhooks cover sent/opened/bounced natively. Revisit
  only if broader product analytics is wanted.
- **ZITADEL owns SMTP (built-in templates)** — two senders, split template stores; rejected in
  favor of return-code → n8n (D5). Kept as the fallback if return-code mode proves awkward.
- **App-owned 2FA (custom OTP + n8n)** — rebuilds IdP-grade rate-limiting/replay/recovery that
  ZITADEL already does well; rejected for auth-grade step-up (D9). Fine only for non-auth SMS.
- **Postmark over Resend** — stronger inbound, but inbound is out of v1 scope; Resend chosen for
  outbound DX. Note preserved so a future inbound need can reconsider.
- **Fold the table into `fnb-n8n`** — mixes engine-log and app-notification concerns; rejected for
  a dedicated `fnb-notify` (D2).
