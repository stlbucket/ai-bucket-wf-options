# Notifications (`fnb-notify`) — Spec Index

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below, then
> executes it.

## Status

**Phases 1, 2, 4 IMPLEMENTED & verified 2026-07-22** (plan `0360…` → `.claude/issues/addressed/`).
The `fnb-notify` pipeline + site-admin `send-test` page are live; a real send was verified
end-to-end through the authenticated UI (Mailpit delivery + `notify.notification` row with the
caller's tenant/profile). Phase 3 (invitation email) and Phase 5+ (SMS/2FA) remain **deferred** —
this README is their durable entry point. Locked decisions captured 2026-07-22.

**SMS track added (2026-07-22).** The multi-channel `channel` enum was there from day one (D8); the
SMS *dispatch/UX* is now specced across two near-term phases plus the deferred auth-grade 2FA:
- **SMS Phase 0** — dev SMS **sink** (log-sink, D11 — chosen after a 3-option "Mailpit for SMS"
  comparison, `infrastructure.md`) + a site-admin **SMS-Test page** that renders the captured body
  as the in-app inbox (`sms-test.*`).
- **SMS Phase 1** — a profile **preferred-method(s)** chooser (`profile-preferences.*`, D12
  `notify.channel_preference`) gated on **phone verification** (D13, `phone-verification.workflow.md`).
- **Phase 5+** — auth-grade SMS **2FA** stays deferred to ZITADEL (D9, `sms-2fa.future.md`).

**Scope split (decided 2026-07-22 at plan time):**
- **This plan → Phases 1, 2, 4** — the `fnb-notify` DB module, the `send-notification` +
  `notification-webhook` workflows, and the **site-admin `send-test` page**. A complete,
  end-to-end-verifiable pipeline.
- **Phase 3 (invitation email) — NOW SPECCED ELSEWHERE (2026-07-22).** Superseded by
  `.claude/specs/user-invitation/` — a full ZITADEL-driven onboarding ceremony (eager user
  creation → verify-email → set-password → login) that **reuses this `send-notification` pipeline**
  as its sender (templates `user-invitation` + `set-password`). The original no-magic-link draft
  (`invitation-email.data.md`) is retained as the rejected alternative. That spec resolves the
  "where does the invite surface live" question: an n8n `invite-user` workflow fired from a
  tenant-app admin action.
- **Phase 5+ (SMS/2FA) — DEFERRED** (`sms-2fa.future.md`).

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
| D11 | Dev SMS sink (re-evaluated) | **Log-sink confirmed** over mock-Twilio-with-UI + Prism (3-option comparison, `infrastructure.md`); the **SMS-Test page** is the browsable inbox | Zero new infra + already the audit trail; the in-app page supplies the UI. mock-Twilio (`NOTIFY_SMS_PROVIDER=mock-twilio`) is the pre-approved upgrade if a Twilio-shaped round-trip is needed; Prism = optional CI contract check |
| D12 | Preferred method(s) | **`notify.channel_preference`** table (per `(profile, channel)`), user-owned with a public `notify_api` two-layer mutation (RLS `profile_id = jwt.profile_id()`) | Keeps `app.profile` lean + notify concerns module-cohesive; multi-select "methods" plural |
| D13 | SMS enable gate | **SMS can't be enabled until the phone is verified** — non-auth OTP via `phone-verification` workflow + `notify.phone_verification`; app-owned OTP acceptable (non-auth only) | Don't text unverified numbers; app-owned OTP is fine off the login path (auth-grade stays with ZITADEL, D9) |

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
| `sms-test.ui.md` | **SMS Phase 0** — site-admin **SMS-Test page** = compose SMS + the **log-sink inbox** (renders captured body; the "Mailpit for SMS") |
| `sms-test.data.md` | SMS-Test data — `triggerWorkflow('send-notification', {channel:SMS})` + `RecentSmsNotifications` (channel-filtered, body exposed) |
| `profile-preferences.ui.md` | **SMS Phase 1** — `<NotificationPreferences>` card on `/auth/profile`: choose method(s) + inline phone verification |
| `profile-preferences.data.md` | Preferences data — `notify.channel_preference` read/write + `verify_phone_code`; `useNotificationPreferences` |
| `phone-verification.workflow.md` | **SMS Phase 1** — the `phone-verification` n8n workflow (generate+persist OTP, send via `send-notification`) |
| `sms-2fa.future.md` | Non-auth SMS **now promoted** (Phase 0/1); **auth-grade 2FA stays future** — ZITADEL MFA + HTTP-SMS-provider → n8n webhook |

## Implementation Task List

Phased build order; each phase is independently verifiable.

### Phase 1 — DB module `fnb-notify` (`_shared.data.md`)  ✅ COMPLETE (deployed + verified 2026-07-22)
- [x] Sqitch package `db/fnb-notify/` — schemas `notify` / `notify_fn` / `notify_api`; enums
      `notify.notification_channel` (`email`, `sms`) + `notify.notification_status`
      (`queued`, `sent`, `delivered`, `opened`, `bounced`, `failed`); `notify.notification` table
      + indexes; `notify_fn.record_send` / `notify_fn.update_delivery` / `status_rank` (SECURITY
      DEFINER); `notify_api.notifications` read (gated `p:app-admin-super`); grants + RLS +
      `n8n_worker` execute grants. Verified live: schemas/fns/policy present.
- [x] Register `fnb-notify` in `DEPLOY_PACKAGES` (`.env` / `.env.example`) **after `fnb-n8n`**.
- [x] Matching `revert/` + `verify/` + pgTAP (`test/`); **no `git` during sqitch sessions**.

### Phase 2 — Dispatch + callback workflows  ✅ COMPLETE (imported + send path verified 2026-07-22)
- [x] `n8n/workflows/send-notification.json` — Webhook (header-auth) → If channel → render → Send
      Email (Mailpit) with a `failed`-row error branch → `record_send`; sms → log-sink record.
      (Resend HTTP branch deferred to prod wiring.)
- [x] `n8n/workflows/notification-webhook.json` — Webhook → map Resend/Twilio event → `update_delivery`
      (skeleton; **signature verification still TODO before prod**).
- [x] Register `send-notification` in `WORKFLOW_REGISTRY` (`p:app-admin-super`); both load via
      `n8n-import`. `fnb-smtp` credential template added.
- [x] Verify: POST `send-notification` → **Mailpit delivered** + `notify.notification` row `→ sent`
      with `provider_message_id`. ✅

### Phase 3 — Invitation email  → MOVED to `.claude/specs/user-invitation/` (2026-07-22)
- [x] Design decision resolved: the invite surface is an **n8n `invite-user` workflow** fired from a
      tenant-app admin "Invite User" action (reuses `app_fn.invite_user`; ZITADEL user created
      eagerly). The `user-invitation` + `set-password` email templates are added to
      `send-notification` there. Build it via `/fnb-stack-implementor .claude/specs/user-invitation/README.md`.
- [x] Original no-magic-link draft (`invitation-email.data.md`) superseded — kept as the rejected
      alternative (that flow carried no auth token; the new flow sets the password in ZITADEL).

### Phase 4 — Site-admin test page (`send-test.ui.md`, `send-test.data.md`)  ◐ built + data layer verified
- [x] `send-test` page in tenant-app site-admin (channel/to/template/body form), gated
      `p:app-admin-super`.
- [x] `useSendTest` composable → the existing `triggerWorkflow('send-notification')` surface
      (not a REST route — reuses the trigger plugin, which injects claims + gates the key).
- [x] `useRecentNotifications` → `notifyNotificationsList` (RLS super-admin reads). Read path +
      gate verified live (anon raises).
- [x] `fnb-types` `Notification` + mapper + barrels + tenant-app re-exports; codegen + package
      build green.
- [~] Nav entry edited into `…010240_app_fn.sql` (in-place) — **lands on next full reseed/rebuild**
      (asset-manager precedent); page reachable by URL meanwhile.
- [ ] Verify (authenticated UI): send a test email from the page → Mailpit + row + toast + the
      recent-sends table (needs a super-admin browser session).

### SMS Phase 0 — dev sink + SMS-Test page (`sms-test.*`, `infrastructure.md`)  ← ready to build
- [ ] `send-notification` **`sms` branch**: `log-sink` provider — render body → `notify_fn.record_send`
      (channel `sms`, provider `log-sink`, status `sent`, rendered body in `payload`), **dispatch nothing**.
- [ ] Expose the **rendered-body projection** for SMS rows (reconcile with the `_shared.data.md`
      PII/hide Open Question) so the inbox can show message content.
- [ ] **SMS-Test page** `/tenant/site-admin/sms-test` (`p:app-admin-super`): compose form +
      channel-filtered **SMS inbox** table (body visible). `useSmsTest` + `useRecentSmsNotifications`
      (may share a `channel`-arg composable with `send-test`).
- [ ] Remove the disabled `SMS` option from the email `send-test` page; cross-link to SMS-Test.
- [ ] Nav entry (icon `i-lucide-message-square-text`) edited into `…010240_app_fn.sql` (lands on reseed).
- [ ] Verify: POST an SMS via the page → `notify.notification` row (`sms`/`log-sink`/`sent`) + body
      visible in the inbox + toast.

### SMS Phase 1 — profile preferences + phone verification (`profile-preferences.*`, `phone-verification.workflow.md`)  ← ready to build
- [ ] `_shared.data.md` schema: `notify.channel_preference` + `notify.phone_verification`;
      `notify_api.set_channel_preference` / `notify_api.verify_phone_code` (two-layer, R8) +
      `notify_fn.request_phone_verification`; RLS self-scoped (`profile_id = jwt.profile_id()`);
      `n8n_worker` execute on the new `notify_fn` routine. Sqitch change + revert/verify/pgTAP.
- [ ] `ChannelPreference` in `fnb-types` + mapper (`toChannelPreference`) + barrels; expose the
      preference read + the two mutations via `notify_api` (codegen).
- [ ] `useNotificationPreferences()` (read + `setEnabled` + `requestPhoneVerification` + `verifyPhoneCode`),
      thin re-export in auth-app.
- [ ] `<NotificationPreferences>` card on `/auth/profile` (D13 gate: SMS switch disabled until
      `verifiedAt`); update `auth-app/profile.ui.md` + `profile.data.md`.
- [ ] `n8n/workflows/phone-verification.json` + `WORKFLOW_REGISTRY` entry (authenticated;
      `profileId` from claims). Template `phone-verify`.
- [ ] Verify: pick SMS → send code → read it from the SMS-Test inbox (dev) → verify → SMS enables.

### Phase 5+ — auth-grade SMS **2FA** (`sms-2fa.future.md`)  ← deferred (ZITADEL-owned)
- [ ] Twilio provider in `send-notification` (`sms` branch) for prod; dev stays log-sink.
- [ ] ZITADEL: enable MFA/login policy; point SMS delivery at the n8n **HTTP SMS provider** webhook
      (verify availability on the running ZITADEL version — Open Question).
- [ ] `notification-webhook`: Twilio status-callback mapping (delivered/undelivered/failed).

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
- **Mock-Twilio-with-UI container as the dev SMS sink** (`dgeorgiev/twillio-sms-mock`,
  `notfoundsam/sms-mock-server`) — the *truest* Mailpit parallel (Twilio-shaped endpoint + browsable
  inbox), but an unofficial project to pin/vendor and a second compose service; the log-sink + the
  in-app SMS-Test page already give the catch + inbox (D11). **Kept as the pre-approved upgrade**
  (`NOTIFY_SMS_PROVIDER=mock-twilio`) for when a Twilio-shaped round-trip is needed.
- **Prism serving Twilio's OpenAPI as the dev sink** — validates the request against the real
  contract but has no browsable inbox; better as an **optional CI contract check** than the dev
  sink. Twilio **test credentials + magic numbers** cover a pre-prod real round-trip (needs
  internet + an account, no capture UI) — neither replaces the log-sink for everyday dev.
- **Channel preferences as columns on `app.profile`** — simplest, but mixes notification concerns
  into the core identity table; rejected for a module-owned `notify.channel_preference` (D12).
- **App-owned OTP for the phone-verification gate** — accepted here because it is **non-auth**
  (profile phone verification, not the login step-up); auth-grade 2FA still stays with ZITADEL (D9).
