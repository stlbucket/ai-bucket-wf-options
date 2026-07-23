# Execution log — 0040_recur__spec-code-reconciliation — 2026-07-22

Doc-only leg. The reconciliation surface this run is the notifications feature (new `db/fnb-notify`
module + SMS + invitation ceremony) that landed since 2026-07-19.

## Fixed inline (canonical files)

1. **Deploy-order drift — the 11→12 package landing.** `.env` `DEPLOY_PACKAGES` (the authoritative
   list) now carries **twelve** packages with `fnb-notify` inserted after `fnb-n8n`:
   `fnb-auth fnb-app fnb-n8n fnb-notify fnb-res fnb-msg fnb-todo fnb-loc fnb-storage
   fnb-location-datasets fnb-airports fnb-game`. Two canonical descriptions were stale:
   - **`monorepo-bootstrap-pattern.md`** (§`db-migrate`) — said "all eleven must deploy" with an
     11-package list omitting `fnb-notify`. Updated: added `fnb-notify` in position, extended the
     "`fnb-n8n` must precede …" note to include it (notify send workflow's `n8n_worker` grants),
     "eleven → twelve".
   - **`CLAUDE.md`** (§Structure/DB) — "eleven sqitch packages", 11-package order. Updated to
     "twelve", inserted `fnb-notify` after `fnb-n8n`, added a one-line description of the module
     (outbox + channel prefs + phone-verification OTP; writes via `notify_fn`/`n8n_worker`; spec
     pointer to `.claude/specs/notifications/`).

## Checklist results

- **Pattern files vs code** — the deploy-order drift above was the only concrete pattern-file
  drift. `graphql-api-pattern.md` / `sockets-pattern.md` / `package-layers-pattern.md` spot-checked
  clean against the notify work — the new composables (`useNotificationPreferences`, `useSendTest`,
  `useRecentNotifications`, `useInviteUser`, `useAdminResetPassword`), mappers
  (`notification.ts`, `channelPreference.ts`), and GraphQL ops follow the canonical
  DB→PostGraphile→urql→composable-re-export pattern with no inline re-description.
- **global-rules R1–R24** — no contradiction. The notify pipeline routes through n8n (R22, sole
  engine — the send-notification/webhook/phone-verification workflows), the auth-app REST/H3
  onboarding routes are a legitimate pre-session carve-out (R5), and `notify_api`→`notify_fn` is
  the standard two-layer pattern (R8). No rule edits needed.
- **Per-page specs (R18–R20)** — every notify page has a `.ui.md`+`.data.md` pair. The gap is
  *status drift*, not missing files (see the spawned 0370): several shipped pages' specs still say
  "Draft — fill in all `[FILL IN]`". `app.profile.phone` (written by `verify_phone_code`) confirmed
  to exist (`db/fnb-app/deploy/00000000010220_app.sql:173`) — no phantom column.
- **R21 single-description invariant** — no new inline stack re-descriptions in specs.
- **Package count** — CLAUDE.md's "ten shared packages + game-engines" is still correct
  (`packages/` has 11 dirs = 10 layer/lib + game-engines); notify added files to existing packages,
  not a new workspace package. (The `fnb-stack-spec` skill's "seven packages" wording is stale —
  queued for the 0050 leg.)

## Spawned identified/ items

- **`0370__specs_____notify-sms-spec-reconcile_______LOW__`** — the notifications spec tree lags the
  shipped SMS Phase 0/1 + invitation code: ~6 per-page specs still marked Draft with `[FILL IN]`
  markers whose answers are now settled in code (OTP 6-digit/10-min/5-attempt, prefs page location,
  tags.json5 behaviors), and the README status credits only "Phases 1,2,4". A multi-file Mode-3
  reconciliation — spawned rather than rushed inline mid-sweep (playbook rule). The genuinely
  deferred `sms-2fa.future.md` / `zitadel-codes.data.md` stay as-is.

## Secondary observation (folded into 0370's follow-up, not separately spawned)

- The `.claude/specs/user-invitation/` spec (addressed) also still carries `[FILL IN]` markers for a
  now-shipped ceremony; its reconciliation is adjacent to 0370 and pointed at from that item's scope
  note rather than double-spawned. `password-self-service/` legitimately stays Draft — it is
  **in-flight** (`in-flight/0160__auth__password-self-service`).

## Gate

Doc-only edits (`.md` pattern file + `CLAUDE.md` + one new `identified/*.md`); no code touched.
`pnpm build` unaffected — green as of the 0020 leg.
