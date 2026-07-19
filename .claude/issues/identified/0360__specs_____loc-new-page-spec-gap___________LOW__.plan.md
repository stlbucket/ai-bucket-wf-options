# Plan: `tenant-app/loc/new` page has no spec pair (R18 gap)

> **Execution Directive:** Implement this plan via the `fnb-stack-spec` skill (Mode 1 —
> reverse-engineer) — invoke it on *this* plan file. Doc-only. Never run `git`.

**Severity: LOW** · Workstream: WS3 (specs) · Identified: 2026-07-19 (recurring spec/code
reconciliation sweep)

## Details

`apps/tenant-app/app/pages/loc/new.vue` exists but `.claude/specs/tenant-app/loc/` contains
only `_shared.data.md`, `index.*`, and `[id].*` — no `new.ui.md` / `new.data.md`. Every other
tenant-app page has its pair (verified by a full pages-vs-specs diff this run; the two
`site-admin/wf-*` pages are specced in `.claude/specs/n8n-parallel-engine/` — organizational
choice, not a gap).

Also noted while here: `.claude/specs/tenant-app/loc/` and `.claude/specs/tenant-app/tools/`
predate the module-README requirement and have no `README.md` (spec-index + Execution
Directive + locked decisions). Backfill both while writing the missing pair.

## Suggested fix

Mode 1 reverse-engineer: read `loc/new.vue` + the composable it calls, write `new.ui.md` +
`new.data.md` (authoritative, Known Gaps not `[FILL IN]`), and backfill the two missing module
READMEs (status `Implemented`, retro-checked task lists).

## Verification

- Pages-vs-specs diff for tenant-app returns no unmatched page.
- Both spec dirs carry a README with an Execution Directive header.
