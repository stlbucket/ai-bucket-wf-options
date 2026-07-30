# Execution log — 0050_recur__skill-drift-reconciliation — 2026-07-30

Doc-only leg (skill governance). Drift surface this run: the OTP-login pre-claims functions
(R21 debt queued from the 0040 leg), the todo multi-assignee refactor, and stale routing-table
wording.

## Fixed inline

1. **`fnb-stack-implementor/SKILL.md`** — the pre-claims root-of-trust inventory (queued by the
   0040 leg per R21):
   - "Never GraphQL-ify" special case now names the first-run pair (`anchorExists` /
     `initializeAnchor`) and the OTP quick-login set (`getDeepLink` / `requestOtpLogin` /
     `verifyOtpLogin` / `sessionInfo`), plus `createSession`'s optional `authMethod` arg.
   - "Pre-claims fns" Key File Paths row extended with the actual files
     (`mutations/{initialize-anchor,request-otp-login,verify-otp-login}.ts` +
     `queries/{anchor-exists,get-deep-link,session-info}.ts` — verified on disk).
2. **`skill-map.md`** — `fnb-create-app` row said "nginx location"; the repo (and the skill
   itself) use a **Caddy handle block**. Corrected.
3. **`fnb-stack-spec/SKILL.md`** module table:
   - Added the missing **`tools/todo`** row (Implemented — GraphQL, templates + deep copy,
     **multi-assignee 2026-07-30**: `todo.todo_assignee`, `addTodoAssignee`/
     `removeTodoAssignee`, single-slot `assign_todo` dropped).
   - `tools/poll` row still said "OTP share deferred (otp-login-gated)" — the share shipped
     2026-07-28 via the generic `ShareModal`. Corrected.

## Checklist results

- **Schema/helper names** — `jwt.*` citations verified against `00000000010150_jwt.sql` (0030
  leg re-read it); no skill cites the dropped `todo_api.assign_todo`/`todo_fn.assign_todo`.
- **File paths** — every concrete path in `fnb-stack-implementor`'s Key File Paths table
  resolves on disk (scripted check; remaining "misses" are `<app>`-style placeholders).
- **Package/db lists** — unchanged since 2026-07-23 (no new workspace or db package); "ten
  shared packages + game-engines" and the thirteen-package `DEPLOY_PACKAGES` lists still match.
- **Version pins** — catalog `@nuxt/ui ^4.6.1` / `nuxt ^4.4.2` unchanged; no conflicting pin in
  any skill.
- **SKILL.md casing** — clean (no lowercase `skill.md` anywhere).
- **R21 inline re-description** — this run's fixes are inventory/reference lists, not stack
  restatements; the known implementor restatement issue remains tracked as
  `0520__skills____implementor-stack-restatement`.
- **`fnb` menu skill** — not in the routing tables but deliberately registered via the map's
  Change-management section (menu vs routing split) — not drift.

## Spawned identified/ items

None — all findings were reference-list corrections, fixed inline.

## Gate

Doc-only edits (three SKILL.md/map files); `pnpm build` unaffected — green as of the 0020 leg.
