# Plan: fnb-app sqitch change `010241_app_fn_support_ticket` is missing revert + verify files

> **Execution Directive:** Implement via the `true-up-sqitch-package` skill.
> Invoke: `/true-up-sqitch-package db/fnb-app`
> Never run `git` in a sqitch session; never redeploy the DB yourself — ask the user, then verify read-only.

**Severity: LOW-MEDIUM** (revert path broken for this change) · Workstream: WS4 · Identified: 2026-07-05

## Details

`db/fnb-app` has a deploy file and a `sqitch.plan` entry for
`00000000010241_app_fn_support_ticket` (`db/fnb-app/sqitch.plan:6`) but **no matching revert or
verify file** — `db/fnb-app/revert/` and `db/fnb-app/verify/` both jump `010240` → `010242`. This is
the only deploy/revert/verify mismatch in the entire db tree (every other change across all 8
packages is complete, and no orphan deploy files exist anywhere). It violates global-rules R10
("Every change has a deploy + revert + verify file").

## Implication

`sqitch revert` to or past this change will fail (no revert script), and `sqitch verify` has no
assertion for it — so a broken deploy of the support-ticket functions wouldn't be caught by verify.
For a change management system whose value is safe up/down migration, a missing revert is a real gap
in the reversibility guarantee.

## Suggested fix

Run the `true-up-sqitch-package` skill against `db/fnb-app` — it's built exactly for this:

1. Author `db/fnb-app/revert/00000000010241_app_fn_support_ticket.sql` that drops what the deploy
   creates (inspect the deploy file for the exact `support_ticket` `_fn`/`_api` functions/objects to
   drop, in reverse dependency order).
2. Author `db/fnb-app/verify/00000000010241_app_fn_support_ticket.sql` asserting those objects exist
   (e.g. `SELECT ... FROM pg_proc WHERE ...` / `has_function_privilege`, per house verify style —
   check a sibling verify file for the pattern).
3. Confirm `sqitch.plan` ordering/dependencies remain valid.
4. Do **not** run git during the sqitch session (project rule).

## Verification

- `db/fnb-app/{revert,verify}/00000000010241_app_fn_support_ticket.sql` both exist.
- `sqitch verify` (user-run against a deployed DB) passes for the change; a `sqitch revert` to
  `010240` succeeds in a throwaway DB.
- The `true-up-sqitch-package` skill reports the package fully synced (no remaining gaps).
