# Plan: sqitch-expert skill — wrong on cross-package deps, incomplete package list, nonexistent deploy script

> **Execution Directive:** Implement via the `fnb-stack-spec` skill (skill governance).
> Invoke: `/fnb-stack-spec .claude/issues/identified/skill-sqitch-expert-corrections.plan.md`
> Doc-only. Never run `git`; commits are human-only.

**Severity: HIGH** · Workstream: WS1 · Identified: 2026-07-05

## Details

`.claude/skills/sqitch-expert/SKILL.md` (275 lines) is stale on three points:

1. **Claims cross-package dependencies are unsupported:** *"Cross-package dependencies are NOT
   supported — separate packages are independent deployment units."* This directly contradicts
   actual usage across the tree:
   - `db/fnb-app/sqitch.plan`: `[fnb-auth:00000000010100_extensions]`
   - `db/fnb-msg`, `db/fnb-todo`, `db/fnb-storage`: `[fnb-app:00000000010220_app]`
   - `db/fnb-loc`, `db/fnb-wf`: `[fnb-app:00000000010250_app_policies]`
   The whole deploy order depends on cross-package requires.
2. **Lists only 5 packages** under `db/` (fnb-auth, fnb-app, fnb-loc, fnb-msg, fnb-todo) — **omits
   fnb-wf, fnb-storage, and my-app** (8 total).
3. **Points deployment at `scripts/db-deploy.sh`** with per-package `docker run … sqitch/sqitch
   deploy` blocks — **that shell script does not exist**. The real mechanism is `scripts/db-deploy.ts`
   (tsx) driven by `db/db-config.ts` (`dbPackages[]` with `deployOnBuild`/`schemas`) and the
   `db-migrate` docker-compose service.

## Implication

Anyone using this skill to add a module will be told they can't declare the cross-package dependency
the pattern actually requires, will miss two real packages (including the security-sensitive wf and
the active storage work), and will be sent to edit a script that isn't there. Given sqitch changes
are deploy-time and hard to unwind, wrong guidance here is expensive.

## Suggested fix (fix + enrich)

1. **Correct the cross-package claim:** document the real syntax `[<package>:<change>]` in a
   `requires`/dependency, with the actual examples above. Explain deploy ordering is governed by
   `db/db-config.ts` package order + intra/inter-package requires.
2. **Update the package inventory** to all 8 (note my-app is removable cruft — see
   `dead-code-sweep.plan.md`; cross-link).
3. **Replace the `db-deploy.sh` deployment section** with the real flow: `db/db-config.ts`
   registration (`dbPackages[]`, `deployOnBuild`, `schemas`), `scripts/db-deploy.ts` /
   `pnpm db-deploy` / `pnpm db-rebuild`, and the `db-migrate` compose service. Reference
   `.claude/specs/monorepo-bootstrap-pattern.md` if it covers deployment, rather than duplicating.
4. **Enrich** with the true-up cross-reference: the `010241_app_fn_support_ticket` change is missing
   revert/verify (`fnb-app-sqitch-true-up.plan.md`) — a live example of the drift the
   `true-up-sqitch-package` skill fixes.
5. Keep the accurate change-add/revert/verify/tag/rework mechanics.

## Verification

- No reference to `db-deploy.sh` or "cross-package … NOT supported" remains
  (`grep -n 'db-deploy.sh\|NOT supported' .claude/skills/sqitch-expert/SKILL.md` → empty).
- Package list matches `ls db/` (minus config/seed files).
- Deployment section names `db-config.ts` + `scripts/db-deploy.ts` + `db-migrate`.
