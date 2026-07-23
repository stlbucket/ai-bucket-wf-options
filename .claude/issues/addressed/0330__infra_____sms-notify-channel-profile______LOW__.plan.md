# SMS notification channel — dev sink, SMS-Test page, profile preferences

> **Execution Directive:** plan + build this via `/fnb-stack-implementor <this plan>` — the
> implementor executes the phases below in order. Source of truth for every contract is
> `.claude/specs/notifications/` (README + the `sms-*`, `profile-preferences.*`,
> `phone-verification.workflow.md`, `_shared.data.md`, `infrastructure.md` files). This plan
> **sequences** that spec; it does not restate it.

## Meta
- **Category:** infra (notify family — mirrors the parent `0360…notifications-fnb-notify`, addressed)
- **Severity:** LOW (net-new opt-in feature, no regression risk to the shipped email pipeline)
- **Spec:** `.claude/specs/notifications/README.md` — SMS Phase 0 + SMS Phase 1 task lists (D8, D10–D13)
- **Depends on:** the shipped `fnb-notify` pipeline (Phases 1/2/4 — `0360…`, addressed)
- **Out of scope:** Phase 5+ auth-grade 2FA (ZITADEL-owned, D9), Twilio **prod** dispatch, the
  `mock-twilio` container upgrade (`NOTIFY_SMS_PROVIDER=mock-twilio`), delivery webhooks.

## Verified anchors (state at plan time)
- `WORKFLOW_REGISTRY` → `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts:14`.
  `send-notification` already registered at line 27 with `permission: 'p:app-admin-super'`.
- `n8n/workflows/send-notification.json` **already has an `sms` / `log-sink` branch** (`record_send`,
  channel switch present) — Phase 0 **verifies + extends** it, does not create it.
- `fnb-notify` sqitch package exists: `db/fnb-notify/deploy/00000000011240_notify.sql` …
  `…011270_notify_policies.sql`. New changes append after `011270`.
- PostGraphile already exposes `notify` + `notify_api`
  (`apps/graphql-api-app/server/graphile.config.ts:40-41`) — **no schema-list edit needed**.
- Email test page to parallel: `apps/tenant-app/app/pages/site-admin/send-test.vue`;
  composables `packages/graphql-client-api/src/composables/{useSendTest,useRecentNotifications}.ts`.
- Profile host page: `apps/auth-app/app/pages/profile.vue` (card grid).

---

## Execution status — 2026-07-22 (COMPLETE — both phases built, deployed & verified)

**All code landed; env rebuilt; DB deployed; workflows imported.** Verification done:
- **pgTAP** `test/030-prefs.sql` — **9/9** (RLS self-scope, the D13 SMS-verify gate, OTP
  wrong/right/expiry, verified_at, phone mirror, cross-user isolation).
- **Live schema introspection** — `channelPreferencesList`, `setChannelPreference`, `verifyPhoneCode`
  present; codegen green; `fnb-types` + `graphql-client-api` build; auth-app + tenant-app typecheck
  clean for all new files (remaining typecheck errors are pre-existing, unrelated).
- **End-to-end API smoke test** (real n8n webhooks, no browser): `send-notification` (sms) →
  `sms/sent/log-sink` row with `{body}`; `phone-verification` → bcrypt-hashed `phone_verification`
  row **and** an sms notification with `{code}` (the dev OTP-in-the-inbox flow). Test rows cleaned up.
- **Nav** `tenant-site-admin-sms-test` row present (rebuild ran fresh). **n8n** has both
  `send-notification` + `phone-verification` active.

**Fix found & applied during verify:** the pgTAP caught that `authenticated` lacked **USAGE on
schema `notify_fn`** (the package granted it to `n8n_worker` only) — added to `011300` (+ revert +
verify) and applied live so the running DB matches the migration.

**Only open item — pure browser-click verification** (logic already verified above): A7 send an SMS
from the SMS-Test page as super-admin; B11 the profile card verify flow. Both need a
ZITADEL-authenticated browser session.

---

## Phase A (SMS Phase 0): COMPLETE & build-verified. Codegen + `fnb-types` + `graphql-client-api`
builds green; tenant-app typecheck clean for the new files (the 25 pre-existing errors are unrelated
debt). Discovery that simplified it: the `send-notification` workflow **already** has the sms
log-sink branch (`Record Sms Sink`) storing `vars → payload`, and `payload` isn't tag-hidden — so
**no DB or workflow change was needed**, only selecting `payload` + the page.
- Only Phase A item left: **A7 browser verify** (needs an authenticated super-admin session; the nav
  row lands on the next reseed).

**Phase B (SMS Phase 1): split by the deploy boundary.**
- **Landed now (no deploy needed to author):**
  - DB change written — `db/fnb-notify/` changes `011280`/`011290`/`011300` (deploy + revert +
    verify) + `sqitch.plan` entries + pgTAP `test/030-prefs.sql`; `phone_verification` hidden in
    `postgraphile.tags.json5`. **Not deployed** (needs an env rebuild — user runs it).
  - `phone-verification` workflow (`n8n/workflows/phone-verification.json`) + `WORKFLOW_REGISTRY`
    entry (`permission: null`). **Not imported** (needs `n8n-import` / rebuild).
  - `ChannelPreference` added to `fnb-types` (+ barrel). Anti-spoof Open Question **resolved**: the
    trigger plugin already forces `profileId` from claims.
- **Deferred — blocked on the DB deploy (codegen needs the new `notify_api` fields live):**
  B5 `.graphql` ops (`MyChannelPreferences` uses the RLS-scoped auto `channelPreferencesList`;
  `SetChannelPreference`, `VerifyPhoneCode`), B4 mapper `toChannelPreference`, B6
  `useNotificationPreferences` (+ auth-app re-export), B9 `<NotificationPreferences>` card +
  `profile.vue` edit, B10 spec sync, B11 verify. **Adding the `.graphql` ops before deploy would
  break Phase A codegen**, so they are intentionally held until the schema is live.

**To unblock the rest (user action — I don't rebuild the env):** rebuild so the `fnb-notify`
changes deploy and n8n re-imports (`docker compose down && docker compose up`, or the project's
`env-rebuild`). Then I finish the deferred Phase B items + run codegen + verify.

---

## Phase A — SMS Phase 0: dev sink + SMS-Test page (`sms-test.*`, `infrastructure.md`)

Goal: a site-admin can compose an SMS that is **captured** (log-sink, nothing dispatched) and
**read the rendered body in-app** — the "Mailpit for SMS."

- [ ] **A1. Verify/extend the `sms` branch** in `send-notification.json`: on
      `NOTIFY_SMS_PROVIDER=log-sink`, render the template body and persist it into
      `notify.notification.payload` (or a `rendered_body`), `record_send(channel='sms',
      provider='log-sink', status='sent', …)`, dispatch nothing. Confirm the existing branch already
      does this; add the rendered-body persistence if missing. Import via n8n (`n8n-cli` skill).
- [ ] **A2. Expose the rendered body for SMS reads.** Decide the projection (Fork F1) and expose it
      on the `notify.notification` read type (smart tags in
      `apps/graphql-api-app/postgraphile.tags.json5` if hiding it from email reads). Reconcile with
      the `_shared.data.md` PII Open Question.
- [ ] **A3. GraphQL op** `RecentSmsNotifications` —
      `packages/graphql-client-api/src/graphql/notify/query/recentSmsNotifications.graphql`
      (`condition: { channel: SMS }`, body field selected, `orderBy: CREATED_AT_DESC`, `first: N`).
      Codegen. (Consider generalizing `useRecentNotifications(channel?)` — Fork F2.)
- [ ] **A4. Composables** `useSmsTest` + `useRecentSmsNotifications` (or the shared `channel`-arg
      variants) in `graphql-client-api`, barrel-exported, thin re-exports in tenant-app. `useSmsTest`
      wraps the existing `triggerWorkflow('send-notification', { channel:'SMS', … })` hook.
- [ ] **A5. SMS-Test page** `apps/tenant-app/app/pages/site-admin/sms-test.vue` (`p:app-admin-super`):
      compose form (E.164 `to`, template, body) + **SMS inbox** `UTable` with the **body column
      visible** and expandable row (per `sms-test.ui.md`; UC4/5/6/7/8/11/13). Toast on send +
      `network-only` refetch.
- [ ] **A6. Nav:** add the `site-admin` "SMS Test" entry (icon `i-lucide-message-square-text` —
      **verify it exists**, UC11) in-place in `db/fnb-app/deploy/00000000010240_app_fn.sql` (lands on
      next reseed — `send-test` precedent). Remove the disabled `SMS` option from `send-test.vue`;
      cross-link to SMS-Test.
- [ ] **A7. Verify (read-only, authenticated super-admin session):** send an SMS from the page →
      `notify.notification` row (`sms`/`log-sink`/`sent`) + rendered body visible in the inbox +
      toast. `POST /graphql-api/api/graphql` (op `TriggerWorkflow` + `RecentSmsNotifications`), no REST.

---

## Phase B — SMS Phase 1: profile preferences + phone verification (`profile-preferences.*`, `phone-verification.workflow.md`)

Goal: a user chooses preferred method(s) on their profile; SMS is selectable only after phone
verification (D13). **→ skill `fnb-db-designer`** before writing the DB change; **→ skill
`n8n-cli`** for the workflow; **→ skill `sqitch-expert`** for the plan entry.

### B-DB — `fnb-notify` change (append after `…011270`)
- [ ] **B1.** New sqitch change (e.g. `00000000011280_notify_prefs.sql`) — tables
      `notify.channel_preference` (`UNIQUE(profile_id, channel)`) + `notify.phone_verification`
      (hashed codes); `_shared.data.md` is the schema of record. **RLS enabled**; self-scoped
      `channel_preference` SELECT policy (`profile_id = jwt.profile_id()`); `phone_verification`
      no client SELECT.
- [ ] **B2.** Functions: `notify_fn.request_phone_verification` (DEFINER, returns plaintext code to
      the worker; `n8n_worker` execute grant), `notify_fn.verify_phone_code` (DEFINER),
      `notify_fn.set_channel_preference` (DEFINER, upsert bound to `jwt.profile_id()`, **raises when
      enabling `sms` unverified**); `notify_api.set_channel_preference` + `notify_api.verify_phone_code`
      (SECURITY INVOKER wrappers, R8). Constants (code len/TTL/attempts/cooldown) — Fork F3.
- [ ] **B3.** `revert/` + `verify/` + pgTAP `test/` for the change (**→ skill `pgtap-expert`**;
      RLS self-scope + the unverified-SMS raise are the key assertions). **No `git` during sqitch.**

### B-GraphQL / client
- [ ] **B4.** `fnb-types`: add `ChannelPreference` (+ barrel) and mapper
      `graphql-client-api/src/mappers/channelPreference.ts` (`toChannelPreference`).
- [ ] **B5.** `.graphql` ops: `MyChannelPreferences` (query), `SetChannelPreference` +
      `VerifyPhoneCode` (mutations) under `src/graphql/notify/{query,mutation}/`. Codegen.
- [ ] **B6.** Composable `useNotificationPreferences()` (`{ prefs, smsVerified, setEnabled,
      requestPhoneVerification, verifyPhoneCode, fetching, error, executeQuery }`), barrel-exported,
      thin re-export at `apps/auth-app/app/composables/`.

### B-Workflow
- [ ] **B7.** `n8n/workflows/phone-verification.json`: webhook → `notify_fn.request_phone_verification`
      → enqueue the SMS by calling `send-notification`'s **n8n webhook directly** (internal
      `X-Fnb-Webhook-Secret`), **not** the gated `triggerWorkflow` (send-notification is
      `p:app-admin-super`; a normal user must not be blocked) — resolves Fork F4. Template
      `phone-verify`.
- [ ] **B8.** Register `phone-verification` in `WORKFLOW_REGISTRY`
      (`trigger-workflow.plugin.ts`) with `permission: null` (any authenticated). **Confirm the
      trigger plugin sources `profileId` from claims, not the client body** (anti-spoof — spec Open
      Question); if it forwards the body only, add claim-sourcing.

### B-UI
- [ ] **B9.** `<NotificationPreferences>` card (shared `tenant-layer` component recommended — Fork F5)
      rendered in `apps/auth-app/app/pages/profile.vue`'s grid: channel switches (SMS `:disabled`
      until `verifiedAt`) + inline phone-verify state machine (`profile-preferences.ui.md`;
      UC3/4/6/7/11). Dev OTP hint → read the code from the SMS-Test inbox.
- [ ] **B10.** Keep specs in sync: `auth-app/profile.ui.md` + `profile.data.md` already reference the
      card — verify accurate after build.
- [ ] **B11. Verify (authenticated user session):** pick SMS → "Send code" → read the code from the
      **SMS-Test inbox** (dev) → verify → SMS switch enables; `MyChannelPreferences` reflects it;
      enabling SMS pre-verification is rejected both in UI and by `notify_fn`.

---

## Design forks to resolve at build time (recommended defaults)
- **F1 — SMS body projection:** expose `payload` json vs. a scalar `rendered_body`. *Rec:* a scalar
  `rendered_body` exposed **only** for the SMS read path; keep `payload`/`error` hidden (min PII).
- **F2 — composable shape:** one `useRecentNotifications(channel?)` / `useNotifyTest(channel)` vs.
  per-channel wrappers. *Rec:* generalize with a `channel` arg; the email page passes none.
- **F3 — OTP constants:** *Rec:* 6-digit, 10-min TTL, 5 attempts, 60s resend cooldown (in `notify_fn`).
- **F4 — phone-verification → sender wiring:** internal webhook call vs. n8n sub-workflow node.
  *Rec:* internal HTTP call to `send-notification` with the shared secret (bypasses the
  `p:app-admin-super` registry gate). **Chosen above (B7).**
- **F5 — preferences card home:** shared `tenant-layer` component vs. auth-app-local. *Rec:* shared
  layer component (it consumes `notify` GraphQL; reusable).
- **F6 — mirror verified number to `app.profile.phone`:** *Rec:* yes — single source of truth; also
  store on `channel_preference.destination`.

## Completion
On finish, per the implementor hand-off: ask the user before moving this plan to
`.claude/issues/addressed/`.
