# Plan: fnb-create-app skill is tracked as lowercase `skill.md` — undiscoverable on case-sensitive filesystems

> **Execution Directive:** Implement via a git rename (staged only — the user commits).
> Invoke: `/fnb-stack-spec .claude/issues/identified/skill-fnb-create-app-filename.plan.md`
> Never run `git` commit; commits are human-only. The rename itself (`git mv`) stages a change for
> the user to commit — confirm with the user before staging if unsure.

**Severity: MEDIUM** (skill may not load off macOS) · Workstream: WS1 · Identified: 2026-07-05

## Details

`git ls-files .claude/skills/fnb-create-app/` shows the tracked file is **`skill.md`** (lowercase).
Every other skill uses uppercase **`SKILL.md`**. On the current macOS dev machine (case-insensitive
APFS) both resolve, so it works locally — but on a case-sensitive filesystem (Linux CI, Docker
build, another contributor's machine, or the harness's skill loader if it globs `SKILL.md`) the
skill is invisible.

There was also, during the audit, an apparent duplicate (`skill.md` + `SKILL.md` both present, 282
lines, identical) — on a case-insensitive FS these are the same file; git tracks exactly one
(`skill.md`). The fix is a case-only rename, which git needs told about explicitly.

## Implication

The scaffold-a-new-app skill silently fails to load anywhere the filesystem is case-sensitive,
including likely the deployment/CI environment. A skill that only works on the author's laptop isn't
a skill.

## Suggested fix

1. Case-only rename via git (git doesn't detect case-only renames on case-insensitive FS without
   help):
   ```
   git mv .claude/skills/fnb-create-app/skill.md .claude/skills/fnb-create-app/SKILL.md.tmp
   git mv .claude/skills/fnb-create-app/SKILL.md.tmp .claude/skills/fnb-create-app/SKILL.md
   ```
   (two-step to force the case flip). **Stage only — the user commits** (commits are human-only).
2. Confirm no code/config references the lowercase path.
3. While the file is open, align its nav guidance with the corrected DB-driven nav story
   (`skill-fnb-stack-implementor-enrich.plan.md`) and its iconify guidance with
   `iconify-rule-verification.plan.md` — it's otherwise architecture-current (correctly disavows
   createDb/db-types/Kysely, uses getWsUpgradeClaims headers-only, session-cookie-holds-userId).

## Verification

- `git ls-files .claude/skills/fnb-create-app/` → `SKILL.md` (uppercase), no `skill.md`.
- On a case-sensitive checkout (or `git config core.ignorecase false` locally), the file is present
  as `SKILL.md`.
- The staged rename is left for the user to commit; I do not commit.
