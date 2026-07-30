# Execution log — 0040_recur__spec-code-reconciliation — 2026-07-30

Doc-only leg. Reconciliation surface this run: the **todo multi-assignee** refactor, the
**participants/subtree-residents** work, and the **otp-login spec's self-flagged retro-check**
("task list has not been retro-checked … do that in a spec-reconcile pass" — this pass).

## Fixed inline (canonical files)

1. **otp-login README retro-check (the spec's own standing request).** Verified every phase
   against shipped code (`00000000010295_otp_login.sql` functions, db-access wrappers + barrel,
   auth-app `otp/*` + `session-info` endpoints, `go/[id].vue`, `createDeepLink.graphql` +
   `useDeepLink`, D15 return-to round-trip incl. `isSafeReturnTo` in `fnb-types`). Checked all
   task boxes; recorded two **as-built deviations**: `resolveUrnRoute` lives at
   `apps/auth-app/shared/utils/urn-route.ts` (spec said `server/utils/`), and Phase 4b's D14
   send shipped as the **`send-deep-link` n8n workflow** via `triggerWorkflow` (R22) instead of
   an `app_api.send_deep_link` DB fan-out — with the generic `ShareModal` as the surface.
   Open Questions all resolved (D9 constants + the 0510 build); status line updated.
2. **R21 "docs to update when this ships" debt for otp-login — paid.** The spec's docs list was
   almost entirely undone:
   - `graphql-api-pattern.md` (pre-claims carve-out #2) — added the OTP quick-login paragraph
     (deep-link/OTP root-of-trust functions, `createSession(profileId, authMethod)`, per-method
     lifetimes, auth-app `otp/*` consumers).
   - `future-auth/session-refresh-pattern.md` — added the `auth_method` column + per-method
     lifetimes note (otp = 1h idle / 8h cap; existing table = the zitadel branch).
   - `CLAUDE.md` auth model — one-line OTP quick-login pointer.
   - `fnb-stack-implementor` SKILL.md pre-claims inventory — queued to the 0050 leg of this
     same pass (skill governance).
   - Flagged: **`sms-2fa.future.md` does not exist** (referenced from this README +
     `twilio-production-sms/README.md` but never created) — annotated in the README; D8 in the
     README is the surviving record.
3. **`admin/nestable-tenant-types/_shared.data.md` status drift (R20 class, same as last run's
   poll case)** — said `Draft — build-ready` while the module README records Implemented
   2026-07-23. Trued up.

## Checklist results

- **Pattern files vs code** — the otp-login gaps above were the only pattern-file drift found.
- **global-rules R1–R24** — no contradictions from the new work (multi-assignee follows R8/R9;
  the D14 send follows R22's triggerWorkflow posture).
- **Per-page specs (R18–R20)** — todo spec tree already reconciled to multi-assignee (dropped
  `todo.todo.resident_urn`, `todo_assignee` DDL, add/remove mutations — all current);
  participants/subtree work covered by `admin/user/` + `admin/workspace/` +
  `admin/nestable-tenant-types/` specs. All `[FILL IN]` grep hits are benign meta-text.
- **R21 single-description invariant** — held; the OTP additions live in the canonical files
  only.
- **`DEPLOY_PACKAGES`** — `.env`/`.env.example`/`CLAUDE.md` all agree (13 packages).

## Spawned identified/ items

None — all findings fixable inline (doc edits).

## Gate

Doc-only edits (four spec files + `CLAUDE.md`); no code touched. `pnpm build` green as of the
0020 leg (13/13, full turbo).
