---
name: project-spec-system
description: The fnb spec system — location, conventions, file structure, and the three pattern files that govern all implementation
metadata:
  type: project
---

A spec system lives at `.claude/specs/` with top-level pattern files and per-app page-level specs.

**Why:** Separating UI concerns from data concerns lets the data layer change (e.g. transport, query strategy) without touching UI specs. Also enables clear invocation prompts that tell Claude exactly what to read before implementing.

**How to apply:** Always read the relevant spec files and the three top-level pattern files before implementing anything. Use `/fnb-stack-spec` skill to create, update, or reverse-engineer specs.

## Top-level files
- `global-rules.md` — 21 rules (R1–R21); R1 is "all data access through composables", R21 is
  "architecture changes propagate to specs + both skills in the same change" (see [[feedback_architecture_single_source]])
- `graphql-api-pattern.md` — canonical stack: DB → PostGraphile 5 → urql/graphql-client-api →
  composable re-export → Vue (renamed from the retired `rest-api-pattern.md`)
- `package-layers-pattern.md` — the seven packages + codegen workflow
- `sockets-pattern.md` — real-time pattern based on msg module (GraphQL load + WS incremental read)

## Per-page convention
```
<app>/{module}/          # <app> = tenant-app, auth-app, msg-app, graphql-api-app, home-app, asset-storage
  _shared.data.md    ← types, permissions, DB schema shared by all pages in the module
  _overview.md       ← (optional) app/module overview — used by some apps
  index.ui.md        ← layout, components, interactions
  index.data.md      ← GraphQL operations, composables, mutations
  [id].ui.md
  [id].data.md
```

## Status values
- `Implemented` — reverse-engineered, authoritative
- `Draft` — has `[FILL IN]` markers; all must resolve before implementation starts
- `Placeholder` — page exists but has no content yet

## Modules with complete specs (as of 2026-07-05)
tenant-app: admin, msg, site-admin, support, loc, tools — Implemented (GraphQL).
Also: auth-app, msg-app, home-app, graphql-api-app (+ workflow), asset-storage (forward-looking).

## Invocation pattern for implementation
> "Read `.claude/specs/<app>/{module}/{page}.ui.md` and `.data.md` and `_shared.data.md` in full. Also read `global-rules.md` and `graphql-api-pattern.md`. Ask about anything marked [FILL IN] before writing code."
