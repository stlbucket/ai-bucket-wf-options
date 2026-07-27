# twilio-production-sms

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the Implementation Task List
> below, then executes it.

## Status
**PARKED 2026-07-27** (user decision — SMS can be added later). Phases 1–2 + the dev side of
Phase 4 are built and **dev-verified** (plan `0580` in `.claude/issues/identified/` — its
PARKED section is the resume guide); prod was deliberately left on `NOTIFY_SMS_PROVIDER=log-sink`
with blank-tolerant `TWILIO_*` vars so deploys need no Twilio secrets while parked. Resuming =
Phase 0 (Twilio console) + Phase 3 (GH secrets + the `.env.prod.tpl` swap) + prod verification —
no code changes. All Open Questions resolved. Sibling of `.claude/specs/resend-production-updates/`
(the email cutover, shipped 2026-07-26), which explicitly deferred "a real SMS provider" to this
spec.

## Purpose

The `send-notification` n8n workflow is the sole outbound-message chokepoint (notifications D1).
Its SMS branch today is the dev **log-sink**: `If Email` (false) → `Record Sms Sink` — a
`notify_fn.record_send` row with `provider='log-sink'`, **no body render, no dispatch**. The
`phone-verification` workflow (and the site-admin SMS-Test page) already push real SMS payloads
through this branch, so on prod **nothing ever texts anyone** — phone verification is currently
un-completable in production except by a super-admin reading the code out of the SMS-Test inbox.

This spec makes the SMS branch provider-aware, mirroring exactly how the email branch went to
prod (env-driven provider selection, credential template, record-node provider label, delivery
webhooks):

1. **Dispatch** — a runtime branch on `NOTIFY_SMS_PROVIDER`: `log-sink` (dev, unchanged
   behavior, D10/D11 stand) vs `twilio` (prod) → the n8n **Twilio node** over a new
   **`fnb-twilio` credential template**, from the single `TWILIO_FROM_NUMBER`.
2. **SMS body render** — a `Render Sms` Code node (the SMS analog of the email `Render` node):
   `templateKey` → plain-text body. Both providers record the rendered body into
   `payload.body`, which the existing SMS-Test inbox already reads (`sms-test.vue:26-29`).
3. **Delivery status callbacks** — Twilio `StatusCallback` → the existing
   `notification-webhook` workflow (`MessageSid` is already its provider-id key), with
   **X-Twilio-Signature verification** so prod delivery statuses are authenticated.
4. **Prod plumbing** — the three pre-declared `TWILIO_*` vars flow GH secrets →
   `deploy.yml` → `render-env.mjs` → `.env.prod.tpl` → `infra/compose/docker-compose.prod.yml`,
   the same path `RESEND_API_KEY` took.

**Zero DDL.** `notify.notification_channel` already has `sms`; `notification_status` already has
`delivered`/`failed`; `provider` is free text; `notify_fn.record_send`/`update_delivery` are
channel-agnostic. Dev behavior is unchanged (log-sink stays the sink, D11 — no mock-Twilio
container, no new dev infra).

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Spec home | **New `twilio-production-sms/` dir** | Same prod-cutover shape as `resend-production-updates/` (house precedent); the notifications spec tree gets Mode-3 sync pointers at implementation (cross-ref issue `0370` — that tree is already flagged stale). |
| Dispatch mechanism | **n8n Twilio node (`n8n-nodes-base.twilio`) + `fnb-twilio.json.tpl` credential** | Mirrors the `fnb-smtp` pattern exactly (render-credentials.mjs, stable id, env-driven data); `MessageSid` comes back parsed (`$json.sid`); no hand-rolled auth. Fallback if the node can't set `StatusCallback`: HTTP Request node with the **predefined `twilioApi` credential type** — same credential template either way (Open Question 1). |
| Provider selection | **Runtime branch on `$env.NOTIFY_SMS_PROVIDER`** (`twilio` vs anything-else → sink) | One workflow JSON serves dev and prod (R22 — workflows are repo-authored, imported everywhere); same mechanism the reaper/asset-scan already use (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` is set in both compose files). |
| Sender identity | **Single `TWILIO_FROM_NUMBER`** (already pre-declared in `.env.example`) | Simplest; fine for current volume. A Messaging Service SID is an env-compatible upgrade (swap the node's From for the service SID) — rejected for now, see Considered & rejected. |
| Delivery callbacks | **In scope, with X-Twilio-Signature verification** | Prod n8n is publicly reachable (`https://n8n.<domain>` behind Caddy TLS), so callbacks work; an unauthenticated status-mutation endpoint on the public internet is not acceptable (the Resend svix check is still an open item on its own spec — the Twilio check must not block Resend events, so it gates on `MessageSid` presence). |
| SMS body persistence | **`Render Sms` output recorded as `payload.body` for both providers** | The SMS-Test inbox already reads `payload.body` (free-text) / `payload.code` (OTP) — recording `vars ∪ {body}` is a strict superset, so dev display keeps working and gains the actually-rendered text. Resolves the `sms-test.data.md` "rendered-body projection" open question in place. |
| Compliance prereq | **A2P registration is a user-side Twilio-console prerequisite** (Phase 0) | The exact analog of Resend's SPF/DKIM domain verification: US-bound SMS from an unregistered number gets carrier-filtered. Not automatable; documented as a gate. |
| DB changes | **None** | Schema is multi-channel from day one (notifications D8); this cutover is workflow + env + credential only. |

## Files in this spec

| File | Purpose |
|---|---|
| `README.md` | This index — status, locked decisions, task list, open questions. |
| `sms-cutover.md` | The dispatch contract: `fnb-twilio` credential template, the reshaped `send-notification` SMS branch (`Render Sms` → provider branch → Twilio node → record nodes), env-var inventory, compose/tpl/deploy-workflow changes, verification steps. |
| `status-callbacks.md` | The callback contract: Twilio `StatusCallback` wiring, `notification-webhook` status mapping (`MessageStatus` → `notify.notification_status`), X-Twilio-Signature verification, `crypto` builtin allowance. |

## Files touched at implementation (not part of this spec dir)

| Path | Change |
|---|---|
| `n8n/credentials/fnb-twilio.json.tpl` | **New** — `twilioApi` credential, env-driven (`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`), stable id. |
| `n8n/workflows/send-notification.json` | SMS branch: insert `Render Sms` + `If Twilio` + `Send Sms` (Twilio node) + `Record Sms Sent`/`Record Sms Failed`; `Record Sms Sink` gains `payload.body`. Email branch untouched. |
| `n8n/workflows/notification-webhook.json` | `Map Status` gains the Twilio `MessageStatus` map; new `Verify Twilio Signature` Code node gating `Update Delivery` for Twilio-shaped payloads. |
| `docker-compose.yml` (dev) | `n8n-import`: pass `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` (blank-tolerant). `n8n`: pass `NOTIFY_SMS_PROVIDER`, `TWILIO_FROM_NUMBER`, `TWILIO_AUTH_TOKEN` (blank-tolerant); add `crypto` to `NODE_FUNCTION_ALLOW_BUILTIN`. |
| `infra/compose/docker-compose.prod.yml` | Same keys, `:?`-required (next to the existing `NOTIFY_SMTP_*` block). |
| `.env.example` | Update the Twilio comment ("Phase 5+" → this spec); vars themselves already exist. |
| `infra/env/.env.prod.tpl` | `NOTIFY_SMS_PROVIDER=twilio` + the three `TWILIO_*=${TWILIO_*}` lines; retire the "SMS stays log-sink" comment. |
| `.github/workflows/deploy.yml` | Pass the three new GH secrets into the render-env step (next to `RESEND_API_KEY`). |
| `infra/README.md` | Secrets checklist: 22 → 25 repo secrets. |
| `.claude/specs/notifications/` (`README.md`, `infrastructure.md`, `send-notification.workflow.md`, `notification-webhook.workflow.md`, `sms-test.data.md`) | Mode-3 sync once implemented: SMS provider is env-branched Twilio-on-prod; body projection resolved; fold into the issue-`0370` reconcile if that runs first. |

## Implementation Task List

### Phase 0 — Twilio account prerequisites (user-side, console — the SPF/DKIM analog)
- [ ] Upgraded (non-trial) Twilio account; note `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`.
      (Trial accounts only text verified numbers and prefix every message.)
- [ ] Purchase an SMS-capable number → `TWILIO_FROM_NUMBER` (E.164).
- [ ] **US A2P 10DLC registration** (brand + campaign) for that number — or toll-free
      verification if a toll-free number is chosen. Unregistered US traffic is carrier-filtered.
- [ ] Geo permissions: enable the destination countries you actually send to (console →
      Messaging Geographic Permissions); leave the rest off (cost/abuse guard).

### Phase 1 — Credential + env plumbing (dev stays green)
- [x] `n8n/credentials/fnb-twilio.json.tpl` — type `twilioApi`, stable id, data from
      `${TWILIO_ACCOUNT_SID}`/`${TWILIO_AUTH_TOKEN}` (`sms-cutover.md` §Credential).
- [x] Dev `docker-compose.yml`: `n8n-import` env += the two SID/token vars (blank-tolerant
      `${VAR:-}` — render-credentials.mjs fails only on *undefined*); `n8n` env +=
      `NOTIFY_SMS_PROVIDER` (`:?` — already in `.env.example` as `log-sink`),
      `TWILIO_FROM_NUMBER`/`TWILIO_AUTH_TOKEN` (blank-tolerant), `NODE_FUNCTION_ALLOW_BUILTIN`
      gains `crypto`.
- [x] Prod `infra/compose/docker-compose.prod.yml`: same keys, `:?`-required.
- [x] Verify (read-only, after the user rebuilds/restarts): dev import job renders all six
      credential templates and n8n boots; dev SMS still lands in the log-sink inbox.

### Phase 2 — `send-notification` SMS branch (`sms-cutover.md`)
- [x] `Render Sms` Code node: `templateKey` → text body (`phone-verify`, `otp-login`, free-text
      fallback `vars.body`); output `{ body }`.
- [x] `If Twilio` (`$env.NOTIFY_SMS_PROVIDER === 'twilio'`): true → `Send Sms` (Twilio node,
      `fnb-twilio` cred, From `$env.TWILIO_FROM_NUMBER`, error-output wired) → `Record Sms Sent`
      (`provider = $env.NOTIFY_SMS_PROVIDER`, `providerMessageId = $json.sid`) /
      `Record Sms Failed`; false → `Record Sms Sink` (unchanged semantics + `payload.body`).
- [x] Resolve Open Question 1 against n8n 2.30.7 (Twilio node `StatusCallback` support); apply
      the HTTP-Request fallback if needed.
- [x] Verify (dev): SMS-Test page send → row `sms`/`log-sink`/`sent` with the **rendered body**
      visible in the inbox; phone-verification round-trip still works end-to-end.

### Phase 3 — Prod cutover
- [x] Add GH repo secrets `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER`; pass
      them through the `deploy.yml` render-env step; update the `infra/README.md` checklist.
- [x] `.env.prod.tpl`: `NOTIFY_SMS_PROVIDER=twilio` + the three `TWILIO_*` substitutions.
- [ ] Deploy (env-only change: same image tag, re-render + `up -d` + n8n restart per
      `deploy.README.md`), then verify: prod SMS-Test send → **real text received**, row
      `provider='twilio'` with an `SM…` `providerMessageId`; prod phone-verification completes
      from a real phone.

### Phase 4 — Delivery status callbacks + signature (`status-callbacks.md`)
- [x] `StatusCallback` URL on the send (`https://n8n.<domain>/webhook/notification-webhook`).
- [x] `notification-webhook`: Twilio `MessageStatus` → status map (`delivered` → `delivered`,
      `undelivered`/`failed` → `failed` + `ErrorCode`); confirm `notify_fn.update_delivery`'s
      `status_rank` guard prevents late `sent` callbacks downgrading `delivered`.
- [x] `Verify Twilio Signature` Code node (HMAC-SHA1 over URL + sorted params vs
      `X-Twilio-Signature`, token from `$env.TWILIO_AUTH_TOKEN`) — gates `Update Delivery` for
      Twilio-shaped payloads only; Resend events pass through untouched.
- [ ] Verify (prod): a delivered message's row advances `sent → delivered`; a forged callback
      (bad signature) mutates nothing.

## Remaining Open Questions

All resolved at plan time (2026-07-27):

- [x] **1 — Twilio node `StatusCallback` support: CONFIRMED.** Inspected the Twilio node source
      inside the running pinned image (`docker exec fnb_n8n` →
      `n8n-nodes-base/dist/nodes/Twilio/Twilio.node.js`): the SMS→Send `options` collection
      includes `statusCallback`. The Twilio-node primary path stands; the HTTP-Request fallback
      is not needed.
- [x] **2 — E.164 validation: locked to the recommended default** (user-approved at spec
      hand-off) — rely on Twilio's 21211 invalid-number error → the `Record Sms Failed` row.
      Pre-dispatch normalization remains available later hardening.
- [x] **3 — Callback URL behind Caddy: CONFIRMED workable.** Prod proxies
      `n8n.{$DOMAIN} { reverse_proxy n8n:5678 }` (`infra/docker/Caddyfile:75-77`) — Caddy's
      `reverse_proxy` passes the original `Host` and sets `X-Forwarded-Proto` by default, so
      the signature Code node's URL reconstruction works. Keep the one-logged-callback sanity
      check in Phase 4 verification.
- [x] **(bonus) `update_delivery` downgrade guard: ALREADY PRESENT** —
      `db/fnb-notify/deploy/00000000011250_notify_fn.sql:91` guards with
      `status_rank(_status) > status_rank(status)`. Phase 4's "verify/fix" item is
      verify-only; **zero DB changes in this spec, confirmed**.

## Considered & rejected

| Option | Why rejected |
|---|---|
| **HTTP Request node as the primary dispatch** | Hand-rolled where the Twilio node + credential template is the house `fnb-smtp` analog. Kept as the **pre-approved fallback** for Open Question 1 (predefined `twilioApi` credential type keeps the template identical). |
| **Messaging Service SID** | Better deliverability pooling at scale, more console setup now. The env contract stays compatible (swap From for the service SID later); single from-number wins for current volume. |
| **mock-Twilio dev container / changing the dev sink** | D11 stands — dev stays log-sink with the SMS-Test inbox; this spec deliberately changes nothing about dev behavior except recording the rendered `payload.body`. |
| **Skipping signature verification on callbacks** | `notification-webhook` is on the public internet in prod; unauthenticated `update_delivery` lets anyone rewrite delivery history. (The matching Resend svix check remains tracked on `resend-production-updates` OQ2 — not silently absorbed here.) |
| **ZITADEL SMS provider / auth-grade 2FA** | Out of scope — notifications D9 keeps the MFA ceremony with ZITADEL, future spec `sms-2fa.future.md`. This cutover is app-grade SMS (phone verification, OTP share, notifications) only. |
| **A `notify.template` table for SMS bodies** | Same call as email v1: templates stay inline in the workflow Code node; the admin-editable/i18n table remains a notifications-spec open question. |
