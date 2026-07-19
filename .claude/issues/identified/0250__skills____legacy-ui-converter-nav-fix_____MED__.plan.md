# Plan: legacy-ui-converter skill references nonexistent nav-register API + incomplete db package list

> **Execution Directive:** Implement via the `fnb-stack-spec` skill (skill governance).
> Invoke: `/fnb-stack-spec .claude/issues/identified/skill-legacy-ui-converter-nav-fix.plan.md`
> Doc-only. Never run `git`; commits are human-only.

**Severity: MEDIUM** · Workstream: WS1 · Identified: 2026-07-05

## Details

`.claude/skills/function-bucket-legacy-ui-converter/SKILL.md` (343 lines) is mostly current — it
correctly disavows Supabase/Kysely/REST, maps legacy urql→fnb urql, claims-in-localStorage, 2-arg
withClaims. Two stale spots:

1. **"Nav registration pattern" points to `packages/tenant-layer/app/plugins/nav-register.ts` with
   `useNavRegistry().register([...])`** — that file and API do not exist anywhere in `packages/` or
   `apps/` (grep: zero hits). Same phantom API as in the implementor skill
   (`skill-fnb-stack-implementor-enrich.plan.md`). Real nav is DB-driven (`ProfileClaims.modules` +
   `useAppNav`/`AppNav.vue`), which also contradicts global-rules R14. This matters because `wf`
   (one of the converter's five target modules) would need nav wiring during conversion.
2. **Its `db/` module list omits fnb-wf and fnb-storage** even though `wf` is one of the five target
   modules it converts.

## Implication

A conversion run for the msg/todo/loc/wf/app modules would try to register nav via a nonexistent
mechanism, and the wf module (which the converter handles) is under-documented. Since this skill
drives bulk conversion of legacy features, the nav step failing mid-conversion is disruptive.

## Suggested fix (fix + enrich)

1. Replace the nav-register reference with the real DB-driven flow (seed modules/tools via
   `app_fn.install_basic_application` → claims → `useAppNav`), consistent with R14 and the corrected
   implementor skill. Keep the fix identical across both skills so they don't re-diverge.
2. Update the module/db-package inventory to include fnb-wf and fnb-storage.
3. Keep the accurate 1:1 legacy-urql→fnb-urql mapping guidance.
4. R21: this is the same nav-truth fix as `skill-fnb-stack-implementor-enrich.plan.md` — land them
   together (and update the pattern files) so the nav story is corrected in one coherent pass.

## Verification

- `grep -n 'useNavRegistry\|nav-register' .claude/skills/function-bucket-legacy-ui-converter/SKILL.md` → empty.
- The db/module list includes all target modules + fnb-storage.
- Nav guidance matches R14 and the implementor skill.
