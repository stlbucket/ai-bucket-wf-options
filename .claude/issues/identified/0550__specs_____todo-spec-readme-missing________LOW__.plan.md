# Plan: `tools/todo` spec dir is missing its required README.md index

> **Execution Directive:** Implement via the `fnb-stack-spec` skill (Mode 1 — reverse-engineer)
> on `.claude/specs/tenant-app/tools/todo/`. Doc-only. Never run `git`.
> Invoke: `/fnb-stack-spec .claude/issues/identified/0550__specs_____todo-spec-readme-missing________LOW__.plan.md`

**Severity: LOW** · Category: specs · Identified: 2026-07-23 (recurring spec/code reconciliation)

## Details

Every module/feature spec dir requires a `README.md` index (user directive 2026-07-09: status,
purpose, locked decisions, file table, task list, Execution Directive header).
`.claude/specs/tenant-app/tools/todo/` has the four page files (`index.ui.md`, `index.data.md`,
`[id].ui.md`, `[id].data.md` — all `Implemented — GraphQL`, trued up 2026-07-19) but **no
README.md**. Its sibling `tools/poll/` has the full house-shape README; `tools/` itself carries
only `_shared.data.md`. The todo module predates the README requirement and apparently lost/never
gained one when the specs moved under `tools/`.

## Implication

The spec index a reader is supposed to land on doesn't exist for todo; there is no Execution
Directive entry point for future todo extensions (e.g. the OTP share follow-on that poll's README
models), and no locked-decisions record survives sessions.

## Suggested fix

Reverse-engineer a `README.md` for `tools/todo/` per the fnb-stack-spec house shape (status
`Implemented`, retro-checked task list, locked decisions from the existing page specs + code,
self-referential Execution Directive). Consider whether `tools/` itself also warrants a one-line
index README pointing at `poll/`, `todo/`, and `_shared.data.md`.

## Verification

- `.claude/specs/tenant-app/tools/todo/README.md` exists, leads with the Execution Directive,
  and its file table names the four page specs + the tools-level `_shared.data.md`.
- Doc-only: `pnpm build` untouched.
