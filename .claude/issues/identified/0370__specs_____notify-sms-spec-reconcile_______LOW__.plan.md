# Plan: Reconcile the notifications spec tree against shipped SMS + invitation code

> **Execution Directive:** Implement via the `fnb-stack-spec` skill (Mode 3 spec update /
> Mode 1 reverse-engineer). Invoke: `/fnb-stack-spec .claude/issues/identified/0370__specs_____notify-sms-spec-reconcile_______LOW__.plan.md`
> Doc-only — touches `.claude/specs/notifications/` only. Never run `git`.

**Severity: LOW** (doc drift; no functional risk) · Category: specs · Identified: 2026-07-22
(spawned by the 0040_recur spec/code-reconciliation leg of the 2026-07-22 housekeeping run)

## Details

The notifications feature has advanced well past the state its per-page specs describe. Between the
2026-07-19 and 2026-07-22 housekeeping runs, the following **shipped and is live in code**:

- **SMS Phase 0** — `sms-test` page (`apps/tenant-app/app/pages/site-admin/sms-test.vue`) +
  `useSendTest`/`useRecentNotifications` composables + the log-sink channel.
- **SMS Phase 1** — `notify.channel_preference` + `notify.phone_verification` tables +
  `notify_fn.set_channel_preference` / `request_phone_verification` / `verify_phone_code`
  (`db/fnb-notify/deploy/00000000011280–011300`), the `notify_api` wrappers, the
  `setChannelPreference` / `verifyPhoneCode` / `myChannelPreferences` GraphQL ops,
  `useNotificationPreferences`, `NotificationPreferences.vue`, `PhoneSegments.vue`, and the
  `phone-verification` n8n workflow (`n8n/workflows/phone-verification.json`). Shipped under
  `addressed/0330__infra__sms-notify-channel-profile`.
- **Phase 3 (invitation email)** — the ZITADEL onboarding ceremony shipped via
  `addressed/0150__auth__user-invitation` (`invite-user`/`forgot-password` workflows,
  `ChangePasswordForm.vue`, the auth-app `onboard/*` + `change-password` routes,
  `useInviteUser`/`useAdminResetPassword`), reusing the `send-notification` pipeline.

But the spec files still lag:

1. **Status lines** — `profile-preferences.{ui,data}.md`, `sms-test.{ui,data}.md`,
   `phone-verification.workflow.md` (and `send-notification.workflow.md`,
   `notification-webhook.workflow.md`) still read *"Draft — fill in all `[FILL IN]` sections before
   implementing."* despite the code being live. These should move to `Implemented` (Mode 3/1) with
   the `[FILL IN]` questions resolved against actual behavior, or trimmed if moot.
2. **Open `[FILL IN]` decisions now settled by the code** — e.g. OTP length/TTL (6-digit / 10 min,
   `notify_prefs_fn.sql`), attempt limit (5), `phone_verification` retention (kept, `consumed_at`),
   the preferences page location (`apps/auth-app` — `NotificationPreferences.vue`, not tenant-layer),
   the `postgraphile.tags.json5` behaviors (`-*` on phone_verification, list-drop on notification).
   Replace each `[FILL IN]` with the shipped answer.
3. **README status** — line 9 credits only "Phases 1, 2, 4 IMPLEMENTED"; update it to reflect that
   SMS Phase 0/1 and the invitation ceremony have since landed (with pointers to the addressed
   plans), so the README stays the accurate durable entry point.

The genuinely still-deferred material stays as-is: `sms-2fa.future.md` (Phase 5+ 2FA, D9) and
`zitadel-codes.data.md` (deferred past v1, D6) — those `[FILL IN]`s are legitimately forward-looking.
`invitation-email.data.md` is already retained as the rejected no-magic-link alternative (README
D6 note) — annotate it as superseded by `.claude/specs/user-invitation/` rather than filling it in.

## Why LOW

Pure documentation reconciliation. The code is correct and verified end-to-end (per the notify
README + the addressed plans); only the spec status/markers are stale. No build or runtime impact.

## Verification

- No `.claude/specs/notifications/*` file that describes shipped behavior still says
  `Draft — fill in all [FILL IN]` (grep).
- Remaining `[FILL IN]` occurrences are confined to the genuinely deferred `sms-2fa.future.md`,
  `zitadel-codes.data.md`, and the retained-as-rejected `invitation-email.data.md`.
- README status section names the SMS + invitation landings with their addressed-plan pointers.
