# Context-architecture refactor: tool-agnostic layout + orchestrator slimming + dead-weight prune

> **Execution Directive:** plan + execute this via `/fnb-stack-spec <this-file>` (skill + spec
> governance — R21: pattern files, both orchestrators, and affected specialist skills update in
> the same change). Doc/layout-only except mechanical path rewrites in source comments. Never
> run `git` — file moves are plain `mv`; the user commits.

**Category: docs · Severity: MED · Identified: 2026-07-30 (user-directed session)**

## Problem

Three compounding issues, sized in-session 2026-07-30:

1. **Context overload.** A typical `fnb-stack-implementor` invocation loads ~20k tokens before
   reading code: SKILL.md (5,222 words) + four mandated pattern files (~7,900 words) + spec
   README + plan. The implementor restates stack truth it claims not to restate (0520), and
   `fnb-stack-spec` hand-maintains a summary of global-rules it also requires reading.
2. **Tool lock-in.** 2.5 MB of specs — the repo's real documentation — plus architecture docs
   and the issue lifecycle live under `.claude/`, invisible to other agent tools and to humans
   browsing a published repo. The house already has the seed of the fix: vendored skills live
   canonically in `.agents/skills/` (pinned by `skills-lock.json`) with `.claude/skills/`
   symlinks.
3. **Dead weight bills every session.** Skill frontmatter descriptions (80–136 words each) load
   in every session; `graphile-worker-expert` is retired (R22) but still loads a description;
   `design-implementations/` (1.3 MB) documents shipped work; `.claude/architecture/` predates
   the GraphQL migration in places.

## Locked decisions (user, 2026-07-30)

| Decision | Choice | Why |
|---|---|---|
| Neutral knowledge home | `docs/` (visible) | Specs are the project documentation; humans and all tools browse it |
| Issue lifecycle | moves to `docs/issues/` | Full separation — `.claude/` becomes pure adapter |
| Repo-native skills | canonical in `.agents/skills/`, symlinked from `.claude/skills/` | Matches the existing vendored-skill pattern; non-Claude path for other tools |
| `vue-flow-expert` | **keep** (restructure per 0540, do not delete) | User wants it for later canvases |
| Cross-tool entry point | root `AGENTS.md` is the real file; `CLAUDE.md` becomes a symlink to it | agents.md standard (Codex, Cursor, Gemini CLI, Amp, Zed…) |

## Phase 1 — Prune (do first; shrinks everything downstream)

- [x] Delete `.claude/skills/graphile-worker-expert/` (retired 2026-07-17, R22). Its
      `skill-map.md` row becomes a one-line tombstone → `n8n-cli`.
- [x] `vue-flow-expert`: execute **0540** — thin body (<150 lines) + `references/` split
      (core-setup+nodes-and-edges, composables-and-events, built-in-components,
      custom-components; `elkjs-layout.md` exists). Keep the skill registered.
- [x] Trim every repo-native skill's frontmatter `description` to ≤40 words (keep the strongest
      trigger phrases; move long trigger lists into the body). Descriptions are always-on
      context; bodies are pay-per-use.
- [x] `.claude/design-implementations/` — shipped design handoffs (1.3 MB): remove per the
      go/no-go decision (delete — git history retains — or park at `docs/design-history/`).
- [x] `.claude/prompts/` (3 files) — review; fold anything still load-bearing into the owning
      spec, delete the rest.
- [x] `.claude/architecture/` (01–09 narrative docs) — do not audit line-by-line: move wholesale
      to `docs/architecture/` in Phase 2 with a top banner "historical narrative — where this
      differs from `docs/specs/`, the specs win" (same convention the implementor already uses
      for deep-reference docs).

## Phase 2 — Tool-agnostic restructure

- [x] Moves (plain `mv`): `.claude/specs` → `docs/specs` · `.claude/architecture` →
      `docs/architecture` · `.claude/issues` → `docs/issues`. (`.claude/memory`, `commands/`,
      `settings*.json`, `sheep/` stay — Claude-specific adapter/working state.)
- [x] Repo-native skills: move each `.claude/skills/<name>/` dir to `.agents/skills/<name>/`;
      leave a relative symlink at the old path **matching the exact shape of the existing DO
      vendored-skill symlinks** (inspect one first). `skill-map.md` moves canonically too,
      symlinked back.
- [x] **Path sweep** (grep-driven, exclude `node_modules`, `.git`, and `docs/issues/addressed/`):
      rewrite `.claude/specs` → `docs/specs`, `.claude/architecture` → `docs/architecture`,
      `.claude/issues` → `docs/issues`, `.claude/skills` → `.agents/skills` across all ~234
      referencing files (specs, skills, memory files, CLAUDE.md, plan files, and source-code
      comments in `apps/`, `packages/`, `db/`). `addressed/` plans are history — leave their old
      paths; note this in `docs/issues/README.md`.
- [x] Root **`AGENTS.md`**: the neutral map, adapted from today's CLAUDE.md — structure table,
      data-stack one-liner, pointers into `docs/specs/`, `docs/issues/`, `.agents/skills/`,
      conventions. Add a **bootstrap note** listing required non-repo skills (`n8n-cli`,
      `vue-use-expert`) and where they come from — this is remediation option 2 of **0530**.
- [x] Replace `CLAUDE.md` with a symlink → `AGENTS.md` (Claude Code follows symlinks).
- [x] Scrub tool-specific mechanics from neutral docs: in `docs/specs/**`, phrase interaction
      requirements neutrally ("ask an explicit yes/no question") with the Claude mechanism in
      parentheses where useful. Skills may keep tool-specific wording.
- [x] `pnpm build` gate after the sweep (source comments were touched; a sed slip must not ship).

## Phase 3 — Slim the orchestrators + global-rules (executes 0520 + 0240 together)

- [x] **`fnb-stack-implementor`** → thin SKILL.md (~150 lines): the gates ([FILL IN], spec
      required), two entry points + go/no-go + completion hand-off, required-reading list,
      specialist routing, Nuxt-UI-v4 warning, the three-barrels gotcha. Everything else moves to
      `references/`: `new-feature-checklist.md`, `rest-to-graphql-conversion.md` (legacy Mode-4
      companion), `key-file-paths.md`, `special-cases.md` (+ the audit failure signatures from
      0240 §4–5), `testing-conventions.md`. The Security Model / Monorepo Layout / Data Model /
      residency sections are **deleted** in favor of pointers to `graphql-api-pattern.md` +
      `package-layers-pattern.md` (0520 remediation option 1 — trim to altitude).
- [x] Fold in **0240**: give the inline "UC13 — UTable v4" rule a real home + number in
      `ui-components-rules.md` (UC13 stays reserved for form validation; fix all range
      citations); add the mapper-coverage rule where R3 points; skip the Iconify item (waits on
      0300).
- [x] **`global-rules.md`** → every rule trimmed to *statement + why* (2–4 lines). The heavy
      payloads move to their owning docs: R22 → pointer to `n8n-parallel-engine/` +
      `monorepo-bootstrap-pattern.md`; R23's lifecycle + fixed-width naming spec → new
      `docs/issues/README.md` (R23 keeps a 3-line summary + pointer); R24 → pointer to
      `workspace-dependency-integrity-pattern.md`.
- [x] **`fnb-stack-spec`**: delete the "Key Rules to Apply" summary block (global-rules is now
      cheap to read whole); move the ever-growing "Implemented Modules" table to
      `docs/specs/STATUS.md` (status data, not skill procedure); keep the four modes + hand-off.
- [x] **R21 propagation**: update R21's wording (new paths, the `references/` shape as a blessed
      pattern); sweep already covers specialist-skill path references — verify none re-describe
      moved content.

## Coordination

- **Executes**: `0520__skills____implementor-stack-restatement` (option 1),
  `0240__skills____fnb-stack-implementor-enrich` (all but the Iconify item — 0300 first),
  `0540__skills____vue-flow-expert-refs-split` (keep + split, user-directed). Completion
  hand-off asks about moving all four (incl. this file) to `addressed/`.
- **Partially addresses**: `0530__skills____global-skill-repo-portability` — the AGENTS.md
  bootstrap note is its remediation option 2; whether to also vendor `n8n-cli` stays open there.
- Recurring playbooks (`docs/issues/recurring/`) get their path references updated by the sweep.

## Execution notes (2026-07-30 run)

- **Brand assets were a live dependency.** `docker-compose.yml` (`/brand-assets:ro` mount),
  `infra/compose/docker-compose.prod.yml`, and `infra/scripts/deploy.sh` all reference
  `.claude/design-implementations/design_handoff_fn_bucket_brand/assets/` — deleted by the
  Phase-1 prune before the reference was discovered. **Resolved:** the user restored the assets
  dir from git; the 9 asset files now live at `docker/brand-assets/` and all four references
  (`docker-compose.yml`, `docker-compose.prod.yml`, `deploy.sh`, brand-identity README) point
  there. `design-implementations/` is fully removed.
- The path sweep initially touched four `.pnpm-store/v10/files/*` content-addressed cache blobs
  (a skills-CLI npm package's docs mention `.claude/skills`). They had no hard links into
  `node_modules`; the corrupted entries were deleted (pnpm re-fetches on demand).
- Additional R21 fixes made in the same change: `graphql-api-pattern.md` (ProfileClaims now in
  `fnb-types`, barrel/mapper wording per R3, `triggerWorkflow` paragraph agent-app → n8n);
  UTable v4 rule renumbered **UC15** in `ui-components-rules.md` (+ 4 spec citations updated);
  Mode 4 extracted to `fnb-stack-spec/references/mode-4-legacy-rest-cleanup.md`; the
  Implemented-Modules table moved to `docs/specs/STATUS.md` (2 spec README pointers updated).
- `pnpm build` passed after the sweep (exit 0).

## Acceptance

- `grep -rn '\.claude/\(specs\|issues\|architecture\|skills\)' --exclude-dir={node_modules,.git} .`
  → hits only in `docs/issues/addressed/` (history) and this coordination note.
- Word-count gates: implementor SKILL.md ≤ 1,200 words · global-rules.md ≤ 1,200 ·
  fnb-stack-spec SKILL.md ≤ 1,800 · every repo-native skill description ≤ 40 words.
- No content lost: every deleted SKILL.md section is either a pointer target or in a
  `references/` file.
- `AGENTS.md` exists; `CLAUDE.md` is a symlink to it; a fresh session still resolves skills,
  skill-map, memory, and the go/no-go conventions.
- `pnpm build` passes after the source-comment sweep.
- `0050_recur__skill-drift-reconciliation`'s next run has strictly fewer restatement surfaces.
