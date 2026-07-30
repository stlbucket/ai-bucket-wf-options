---
name: fnb-stack-spec
description: >
  Manages the fnb spec system at docs/specs/: create, update, or reverse-engineer specs for any
  feature or page; pattern files and global rules. Use for "create/update a spec",
  "reverse-engineer a spec", "what does the spec say", or finalizing [FILL IN] drafts.
---

# fnb Stack Spec

You manage the spec system for the fnb monorepo. Specs live at `docs/specs/` and are the source
of truth for both existing implementation and planned work — they define the patterns and rules
that govern all implementation. Implementation status board: `docs/specs/STATUS.md`.

## Spec System Overview

```
docs/specs/
├── global-rules.md                  ← implementation rules R1–R24 (terse: statement + why + pointer)
├── graphql-api-pattern.md           ← canonical data stack (DB → PostGraphile → urql → composable → page)
├── sockets-pattern.md               ← WebSocket / real-time pattern (based on msg module)
├── ui-components-rules.md           ← UC1–UC15 UI rules
├── package-layers-pattern.md        ← all ten packages: compiled libs, Nuxt layers, codegen workflow
├── graphql-client-api-package.md    ← codegen details for the client package
├── monorepo-bootstrap-pattern.md    ← Docker Compose, Caddy, pnpm workspace, adding a new app
├── workspace-dependency-integrity-pattern.md ← R24: per-package deps + per-layer TS projects
├── STATUS.md                        ← implemented-modules board (update when things ship)
└── <app>/{module}/                  ← per-app spec trees; nested routes mirror page dirs
    ├── README.md          ← REQUIRED spec index: status, purpose, locked decisions, file table, task list
    ├── _shared.data.md    ← types, permissions, DB schema shared across the module's pages
    ├── _overview.md       ← (optional) module/app overview — used by some apps
    ├── {page}.ui.md       ← per page: layout, components, interactions
    └── {page}.data.md     ← per page: GraphQL ops, composables, mutations
```

Always read before writing specs or plans: `global-rules.md`, `graphql-api-pattern.md`,
`package-layers-pattern.md` (+ `sockets-pattern.md` when real-time is involved,
`workspace-dependency-integrity-pattern.md` when deps change).

### File naming conventions

- `README.md` — **required in every module/feature spec dir** (user directive 2026-07-09):
  Status, Purpose (narrative), **Locked decisions** table (with the why, so reasoning survives
  the session), **Files in this spec** table, phased **Implementation Task List** (checkboxes,
  updated as phases land), Remaining Open Questions, and **Considered & rejected**. House
  precedents: `asset-storage/README.md`, `tenant-app/datasets/breweries/README.md`.
  **Every README leads with a self-referential Execution Directive** (mirroring plan files, R23)
  — it names *this* README, never a hardcoded path:
  ```markdown
  > **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
  > the implementor derives the `docs/issues/` plan file (R23) from the task list below,
  > then executes it.
  ```
  (On `Implemented` specs the directive stays — it is the entry point for future extensions.)
- `*.ui.md` — layout, components (props/emits), user interactions, status badge colors, reactive state
- `*.data.md` — GraphQL operations, composables, mutation functions, response shapes, auth requirements.
  Name both file paths (package composable + app re-export), the `.graphql` document + generated
  hook, the `fetching`/`error` return shape (no `pending`, no `refresh`), and any response
  transformation (composable mechanics: `graphql-api-pattern.md` → Layer 3/4)
- `_shared.data.md` — data types, DB schema, permission model, and mutations spanning pages
- File names mirror the Nuxt page file names: `index.ui.md`, `[id].ui.md`, `[key].ui.md`
- YAML frontmatter is used by some newer specs — additive, keep it if present
- Every spec file starts with a status line: `Implemented — …` / `Draft — fill in all [FILL IN]
  sections before implementing` / `Placeholder — not yet implemented`. Update it when state changes.

### Specialist skills

Specs stay self-contained, but when a spec's *content* needs domain conventions, engage the
owning specialist via `.agents/skills/skill-map.md` (read its `SKILL.md`) — most often
`fnb-db-designer` while drafting `_shared.data.md` (schema, RLS, permission keys), and
`postgraphile-5-expert` when a data contract depends on how PostGraphile shapes the schema.
Implementation is handed to `fnb-stack-implementor`, which does its own specialist routing.

## Four Modes of Operation

### Mode 1: Reverse-engineer a spec from existing code

For pages/features already implemented; the goal is an authoritative record.

1. Explore all relevant files: pages, components, queries, mutations, DB functions, nav entries
2. Create `_shared.data.md` first — data types, DB schema, permission model
3. Create per-page pairs: `{page}.ui.md` and `{page}.data.md` (UI: exact layout, component
   props/emits, badge colors, interactions. Data: operation name + `.graphql` path, generated
   hook, composable + app re-export, shaped return type, transformations; for a `withClaims`
   carve-out, the route path + usage instead)
4. Add a **Known Gaps** section where the implementation is incomplete — never `[FILL IN]`
   (reverse-engineered specs are authoritative, not aspirational)
5. Finish with the **required `README.md`** — status `Implemented`, task list retro-checked
   (no hand-off question — there is nothing to build)

### Mode 2: Create a forward-looking spec for planned work

The contract is defined before implementation.

1. Ask the user clarifying questions for anything unknown — do not guess and write `[FILL IN]`
2. Create `_shared.data.md` with the data model (use `[FILL IN]` for unresolved fields) — read
   `fnb-db-designer` first so schema/RLS/permission contracts use the house dialect
3. Create per-page pairs; mark unknowns `[FILL IN]`; add an **Open Questions** checklist per data file
4. Status line: `Draft — fill in all [FILL IN] sections before implementing`
5. Finish with the **required `README.md`** — status `Draft`, every user decision in the Locked
   decisions table, unchecked task-list phases in build order, Execution Directive at top
6. **Required final step — the hand-off question** (below)

Resolve before hand-off: data-model fields · list-page shape (table/cards/map) · detail-page
layout · gating permission · env vars · nav icon (verify the `i-lucide-*` name exists — the
`loc` copy-paste precedent).

### Mode 3: Update an existing spec

1. Read the existing spec files before editing; update only the sections that changed
2. Move resolved **Open Questions** / filled **Known Gaps** into the main content
3. If only the data layer changes, only `*.data.md` files change — `*.ui.md` untouched
4. Keep the module `README.md` in sync (status, checkboxes, locked decisions); add one (with
   Execution Directive) if the dir predates the requirement
5. If the update leaves **buildable work**, end with the **hand-off question** (below)

### Mode 4: Reconcile a stale REST-era `.data.md` to GraphQL (legacy)

Read `references/mode-4-legacy-rest-cleanup.md` when you touch a `.data.md` that still
describes Nitro REST + `useFetch`. `*.ui.md` files are never touched.

## Hand-off — the required final step (user directive 2026-07-09)

Every spec session that leaves **buildable work** (Mode 2 always; Mode 3 when the contract moved
ahead of the code) ends with an **explicit yes/no question** (AskUserQuestion in Claude Code —
never a soft "let me know"):

> **The spec is complete (no `[FILL IN]`s, Open Questions resolved or deferred). Invoke it now
> so a plan gets made?** — Yes / No

- **Yes** → invoke `/fnb-stack-implementor <path-to-the-spec-README>`. The implementor derives
  the `docs/issues/` plan file (R23), asks its own go/no-go, and executes.
- **No** → stop. The README's Execution Directive is the durable entry point.

Do not skip the question, answer it yourself, or start planning without the Yes.

## Breaking a monolithic spec into per-page files

1. Create the directory structure mirroring the page tree
2. Extract `_shared.data.md` (types, DB schema, permissions, shared mutations)
3. Per page: `{page}.ui.md` + `{page}.data.md`; data files reference `_shared.data.md` rather
   than repeating types
4. Delete the monolithic file after all page files are verified complete

The UI/data split exists so the data layer can change without touching UI specs — keep the
concerns strictly separated.
