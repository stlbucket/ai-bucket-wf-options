---
name: fnb-stack-spec
description: >
  Manages the spec system for the fnb monorepo at `.claude/specs/`. Use this skill when the
  user wants to create, update, or reverse-engineer specs for any feature or page. Triggers
  include: "create a spec for X", "add a spec", "reverse-engineer a spec", "update the spec
  for X", "break a spec into pages", "what does the spec say about X", "add a pattern file",
  "update global-rules", or any time implementation patterns need to be documented or enforced.
  Also triggers when a user fills in [FILL IN] markers and wants to finalize a draft spec.
---

# fnb Stack Spec

You manage the spec system for the fnb monorepo. Specs live at `.claude/specs/` and serve
as the source of truth for both existing implementation and planned work. They also define
the patterns and rules that govern all implementation in this project.

---

## Spec System Overview

```
.claude/specs/
├── global-rules.md                  ← implementation rules (R1–R24) derived from the codebase
├── graphql-api-pattern.md           ← canonical data stack (DB → PostGraphile → urql/graphql-client-api → composable re-export → page)
├── sockets-pattern.md               ← WebSocket / real-time pattern (based on msg module)
├── ui-components-rules.md           ← UC1–UC12 UI rules
├── package-layers-pattern.md        ← all ten packages: compiled libs, Nuxt layers, file inventories
├── graphql-client-api-package.md    ← codegen details for the client package
├── monorepo-bootstrap-pattern.md    ← Docker Compose, Caddy, pnpm workspace, adding a new app
├── workspace-dependency-integrity-pattern.md ← R24: per-package dep declarations + per-layer TS projects
└── <app>/                           ← per-app spec trees (see below)
    ├── {module}/
    │   ├── README.md          ← REQUIRED spec index: status, purpose, locked decisions, file table, task list
    │   ├── _shared.data.md    ← types, permissions, DB schema shared across all pages in module
    │   ├── _overview.md       ← (optional) module/app overview — used by some apps
    │   ├── index.ui.md        ← list/hub page — layout, components, interactions
    │   ├── index.data.md      ← list/hub page — GraphQL ops, composables, mutations
    │   ├── [id].ui.md         ← detail page — layout, components, interactions
    │   └── [id].data.md       ← detail page — GraphQL ops, composables, mutations
    └── {module}/{sub}/        ← nested routes mirror the page directory structure
```

Per-app spec dirs that exist today: `auth-app/`, `home-app/`, `msg-app/`, `graphql-api-app/`
(with `_overview.md`, `server-pattern.md`, and the tombstoned `worker-pattern.md` — workflows
now run on **n8n**, the sole engine; specs `n8n-parallel-engine/` + `agentic-decommission/`, rule
R22), `asset-storage/` (implemented 2026-07-06 — README + infrastructure + endpoint/workflow/graphql
data files + page/component UI files; scan engine is now the n8n `asset-scan` workflow), and `tenant-app/`
(admin, loc, msg, site-admin, support, tools). The tree is not limited to `tenant-app/`.

### File naming conventions
- `README.md` — **required in every module/feature spec dir** (user directive 2026-07-09). The
  spec index a reader lands on: Status, Purpose (narrative), **Locked decisions** table (with
  the why, so reasoning survives the session), **Files in this spec** table, phased
  **Implementation Task List** (checkboxes, updated as phases land), Remaining Open Questions,
  and **Considered & rejected**. House precedents: `asset-storage/README.md`,
  `tenant-app/datasets/breweries/README.md`.
  **Every README leads with a self-referential Execution Directive** (user directive
  2026-07-09), mirroring plan files (R23) — it names *this* README, never a hardcoded path:
  ```markdown
  > **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
  > the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
  > then executes it.
  ```
  (On `Implemented` specs the directive stays — it is the entry point for future extensions.)
- `*.ui.md` — layout, components (props/emits), user interactions, status badge colors, reactive state
- `*.data.md` — GraphQL operations, composables, mutation functions, response shapes, auth requirements
- `_shared.data.md` — data types, DB schema, permission model, and mutations that span multiple pages
- `_overview.md` — (optional) app/module-level overview; some apps use this in addition to page pairs
- `*.future.md` — (optional) forward-looking design for not-yet-built work (none in the tree today
  — `asset-storage/`'s were promoted to `.data.md` files when it shipped)
- File names mirror the Nuxt page file names: `index.ui.md`, `[id].ui.md`, `[key].ui.md`
- YAML frontmatter is used by some newer specs — additive, keep it if present

### Top-level pattern files
Always read these before writing specs or implementation plans:
- `global-rules.md` — implementation rules (R1–R24) enforced across all modules
- `graphql-api-pattern.md` — the canonical data stack: DB → PostGraphile 5 → urql/graphql-client-api
  → composable re-export → Vue (plus the REST/H3 carve-out + pre-claims root of trust)
- `sockets-pattern.md` — real-time pattern based on the `msg` module (GraphQL load + WS incremental read)
- `package-layers-pattern.md` — all ten packages: compiled libs, Nuxt layers, file inventories, codegen workflow
- `monorepo-bootstrap-pattern.md` — Docker Compose topology, Caddy routing, pnpm workspace config
- `workspace-dependency-integrity-pattern.md` — R24: every package declares its own deps (shared
  versions once, via the pnpm default catalog / `"catalog:"` protocol); layers are
  self-preparable TS projects (tsconfig + `nuxt prepare`); `dep-audit` enforcement

### Specialist skills
Specs stay self-contained, but when a spec's *content* needs domain conventions, engage the
owning specialist via `.claude/skills/skill-map.md` (read its `SKILL.md`) rather than working
from memory — most often `fnb-db-designer` while drafting `_shared.data.md` (schema, RLS,
permission keys), and `postgraphile-5-expert` when a data contract depends on how PostGraphile
will shape the schema. Implementation is handed to `fnb-stack-implementor`, which does its own
specialist routing.

---

## Three Modes of Operation

### Mode 1: Reverse-engineer a spec from existing code
For pages/features already implemented. The goal is an authoritative record.

**Workflow:**
1. Explore all relevant files: pages, API routes, components, queries, mutations, DB functions, nav entries
2. Create `_shared.data.md` first — data types, DB schema, permission model
3. Create per-page pairs: `{page}.ui.md` and `{page}.data.md`
4. Add a **Known Gaps** section to any file where the implementation is incomplete or inconsistent
5. Do not use `[FILL IN]` markers — reverse-engineered specs are authoritative, not aspirational
6. Finish with the **required `README.md`** (see File naming conventions) — status
   `Implemented`, task list retro-checked to reflect what exists

**Key things to capture per page (default = GraphQL):**
- UI: exact layout structure, component names + props/emits, status badge color mapping, reactive state shape, user interactions table
- Data: the `.graphql` operation name + file path (`packages/graphql-client-api/src/graphql/<module>/…`),
  the generated hook (`use<Op>Query`/`use<Op>Mutation`), the composable
  (`packages/graphql-client-api/src/composables/use{Domain}.ts`) and its app re-export, the shaped
  return type (`fetching`/`error`/computed data), and any response transformation. For the rare
  REST/H3 carve-out (WS incremental read), capture the route path + `withClaims` usage instead.

### Mode 2: Create a forward-looking spec for planned work
For features that don't exist yet. The goal is to define the contract before implementation.

**Workflow:**
1. Ask the user clarifying questions for anything unknown — do not guess and write `[FILL IN]`
2. Create `_shared.data.md` with the data model (use `[FILL IN]` for unresolved fields) —
   read `.claude/skills/fnb-db-designer/SKILL.md` first so schema/RLS/permission contracts are
   written in the house dialect (`jwt.*` helpers, `<module>`/`_fn`/`_api` trio, `p:` keys)
3. Create per-page pairs — capture what is known, mark unknowns with `[FILL IN]`
4. Add an **Open Questions** checklist at the bottom of each data file
5. Status line at top of every file: `Draft — fill in all [FILL IN] sections before implementing`
6. Finish with the **required `README.md`** (see File naming conventions) — status `Draft`,
   every user decision captured in the Locked decisions table, unchecked task-list phases in
   build order, rejected alternatives recorded, **Execution Directive header** at the top
7. **Required final step — the hand-off question** (see Hand-off below): explicitly ask the
   user, yes/no, whether to invoke the spec now so a plan gets made

**Critical questions to resolve before handing to implementation:**
- What fields does the data model have? (never let implementation guess)
- What does the list page look like? (table? cards? map?)
- What does the detail page look like? (layout, what fields displayed)
- What permission gates the feature?
- Are there any env vars needed? (Mapbox token, etc.)
- What is the nav icon? (caught the `i-lucide-messages-square` copy-paste in `loc`)

### Mode 3: Update an existing spec
When implementation diverges from the spec, or when the spec is extended.

**Workflow:**
1. Read the existing spec files before editing
2. Update only the sections that changed — do not rewrite the whole file
3. Move items from **Open Questions** to resolved content when answered
4. Move items from **Known Gaps** to the main spec when the gap is filled
5. If the data layer changes significantly (e.g. switching to a different transport), only `*.data.md` files change — `*.ui.md` files are untouched
6. Keep the module `README.md` in sync: status, task-list checkboxes, newly locked decisions,
   resolved open questions. If the dir predates the README requirement and has none, add one
   (including the Execution Directive header)
7. If the update leaves **buildable work** (new/changed contract not yet implemented), end with
   the **hand-off question** (see Hand-off below)

### Mode 4 (legacy cleanup): reconcile a stale REST-era `.data.md` to GraphQL
GraphQL is the **default** stack (Modes 1–3 already assume it). This mode is only for cleaning up
an older `.data.md` still written against Nitro REST routes + `useFetch` — the migration already
happened in code. **Rule: `*.ui.md` files are never touched.** Only the data contract changes.

**Workflow:**
1. Create or update `_shared.data.md` — document the **GraphQL Client Setup**:
   - urql plugin (`apps/<app>/app/plugins/urql.client.ts`): `preferGetMethod: false`, exchanges,
     `url` from `runtimeConfig.public.graphqlApiUrl`
   - `packages/graphql-client-api` as the composable source; the app re-export file location
   - Entity/view types come from `@function-bucket/fnb-types` (the shared vocabulary) — replace any
     Kysely/db-types-derived or generated-type docs. Generated codegen types are internal to
     `graphql-client-api` (consumed only by mappers `src/mappers/<entity>.ts`). See R3.

2. For each page's `.data.md`:
   - Remove any `## API` section (REST route path, HTTP method, handler file, Kysely queries)
   - Add a `## GraphQL` section: operation name; `.graphql` file path in
     `packages/graphql-client-api/src/graphql/<module>/{query,mutation}/`; generated hook name
     (`use<Op>Query`/`use<Op>Mutation`) in `src/generated/fnb-graphql-api.ts`; variables; what it fetches
   - Update the `## Composable` section:
     - Source is `packages/graphql-client-api/src/composables/`; add the app re-export location
     - Return shape: `pending` → `fetching`, no `refresh` (use `executeQuery({ requestPolicy: 'network-only' })`)
     - Document any response transformation (flattening nested lists, mapping permission objects)
   - Change status line to `Implemented — GraphQL`

3. Verify no `useFetch`, `$fetch`, or `/api/` references remain (except a genuine `withClaims`
   carve-out — the msg WS incremental read or the storage multipart upload).

---

## Implemented Modules (as of 2026-07-05)

Data layer is **urql GraphQL → PostGraphile** across the board (composables in
`packages/graphql-client-api/src/composables/`, re-exported per app). `tenant-app/` modules:

| Module | Pages | Status |
|---|---|---|
| `admin` | index (hub), user/index, user/[id], license/index, subscription/index, subscription/[id] | Implemented — GraphQL |
| `msg` | index (inbox), [id] (conversation) | Implemented — GraphQL (+ WS incremental read carve-out) |
| `site-admin` | index (placeholder), tenant/index, tenant/[id], user/index, user/[id], application/index, application/[key] | Implemented — GraphQL |
| `support` | tickets/index, tickets/new, tickets/[id] | Implemented — GraphQL |
| `loc` | index, [id] | Implemented — GraphQL (`useLocations`) |
| `games` | battleship/index, battleship/[id], checkers/index, checkers/[id], tic-tac-toe/index (Coming Soon) | Implemented — GraphQL (`useGames`/`useGame`/`useGameTypes`) + n8n referee (`game-event` workflow); battleship + checkers playable |

Other app spec trees: `auth-app/` (login, current-profile-claims, profile), `msg-app/`,
`graphql-api-app/` (`_overview.md`, `server-pattern.md`, tombstoned `worker-pattern.md`),
`home-app/`, `n8n-parallel-engine/` + `agentic-decommission/` (the workflow engine — n8n, the
sole engine, R22), `asset-storage/` (implemented 2026-07-06: storage-layer/storage-app +
quarantine-first `asset-scan`, now running on n8n), and `game-server/` (implemented
2026-07-20: `db/fnb-game` + `packages/game-engines` + `game-layer`/`game-app` + the
`game-event` n8n referee — event-sourced N-seat game platform; battleship + checkers are
playable (checkers = the English-draughts sub-spec `game-server/checkers/`, added 2026-07-20 via
the platform's registry-flip + engine-module + UI-page path, zero DDL)). Some per-page
`.data.md` files are still being reconciled from the REST era — apply Mode 4 (legacy cleanup)
when you touch one.

---

## Key Rules to Apply (from global-rules.md)

Always enforce these. If a spec or implementation violates them, call it out.

**R1** — All data access goes through composables (thin re-exports of `graphql-client-api`). Pages never touch the transport.
**R2** — Components must not make API calls (exception: `Msg.vue` WebSocket — do not copy this pattern).
**R3** — `@function-bucket/fnb-types` is the shared type vocabulary; UI/db-access import types only from it. Generated types are internal to `graphql-client-api`, bridged by mappers (`to<Entity>`). Enum values mirror the GraphQL enums (UPPERCASE); timestamps are `Date`.
**R4** — Composable view types (like `SubscribedTopicSummary`) live in `packages/graphql-client-api/src/composables/`.
**R5** — Default reads/mutations go through PostGraphile; RLS via `pgSettings`. `withClaims(claims, fn)` (2-arg) is the carve-out.
**R8** — All mutations follow the `<module>_api` → `<module>_fn` two-layer PL/pgSQL pattern.
**R9** — All tables have RLS enabled.
**R14** — Navigation is registered in the DB (`00000000010240_app_fn.sql`), not hardcoded.
**R18** — Every page has both a `.ui.md` and a `.data.md`.
**R19** — Shared types go in `_shared.data.md`, not duplicated across page specs.
**R20** — Draft specs use `[FILL IN]` markers. All must be resolved before implementation starts.
**R21** — Architecture changes update `global-rules.md` + the affected pattern file + both skills in the same change.
**R23** — Issue/plan artifacts under `.claude/issues/` follow the 4-dir lifecycle (`identified` → `in-flight` → `addressed`, plus `recurring`) and the fixed-width naming convention `[####]__[category]__[title-slug]__[SEV]__.plan.md` (widths 4/8/30/3, `_`-padded so columns align; SEV ∈ `CRT · HI · MED · LOW`; recurring is `[####]_recur__[title-slug].plan.md` — the `####` prefix is execution order for a housekeeping pass, gapped by 10) with a self-referential Execution Directive. See global-rules R23.

See `.claude/specs/ui-components-rules.md` for the full UI rules (UC1–UC12):
**UC3** — Always use Nuxt UI components before raw HTML or custom CSS.
**UC4** — UCard is the default page content container.
**UC5** — All UIs must be responsive (mobile-first, flex-wrap, overflow-x-auto on tables).
**UC6** — Use Nuxt UI color tokens (`primary`, `success`, etc.), not raw Tailwind color classes.
**UC7** — Use `useToast` for transient feedback; `UAlert` only for persistent warnings.
**UC11** — Icons are `i-lucide-*` only. Verify names before using.

---

## Hand-off — the required final step (user directive 2026-07-09)

Every spec session that leaves **buildable work** (Mode 2 always; Mode 3 when the contract
changed ahead of the code) ends with an **explicit yes/no question to the user** — use
AskUserQuestion, never a soft "let me know":

> **The spec is complete (no `[FILL IN]`s, Open Questions resolved or deferred). Invoke it now
> so a plan gets made?** — Yes / No

- **Yes** → invoke `/fnb-stack-implementor <path-to-the-spec-README>`. The implementor derives
  the `.claude/issues/` plan file (R23) from the README's task list, asks its own go/no-go, and
  executes.
- **No** → stop. The README's Execution Directive is the durable entry point; nothing else to do.

Do not skip the question, answer it yourself, or start planning without the Yes. (Mode 1
reverse-engineering ends without it — there is nothing to build.)

---

## Composable Convention (R1 enforcement)

Composables are **thin re-exports** in feature apps. The real implementation lives in
`packages/graphql-client-api/src/composables/`, wraps generated urql hooks, and shapes the
response. A `.data.md` should document both files.

```ts
// packages/graphql-client-api/src/composables/use{Domain}.ts — the real implementation
import { computed } from 'vue'
import { use{Op}Query, use{Op}Mutation } from '../generated/fnb-graphql-api'

export type {Domain}View = { /* the shaped view type lives here (R4) */ }

export function use{Domain}() {
  const { data, fetching, error, executeQuery } = use{Op}Query()
  const { executeMutation } = use{Op}Mutation()

  const items = computed<{Domain}View[]>(() =>
    (data.value?.{field}List ?? []).filter(Boolean).map(/* → {Domain}View */),
  )

  async function doAction(id: string) {
    const res = await executeMutation({ /* input */ })
    if (res.error) throw res.error
    executeQuery({ requestPolicy: 'network-only' }) // re-run — there is no `refresh`
  }

  return { items, fetching, error, doAction, executeQuery }
}
```

```ts
// apps/<app>/app/composables/use{Domain}.ts — thin re-export (what pages auto-import)
export { use{Domain} } from '@function-bucket/fnb-graphql-client-api'
```

When updating a `.data.md`: name both file paths, the `.graphql` document + generated hook, the
`fetching`/`error` return shape (no `pending`, no `refresh`), and any response transformation.
Remove references to `$fetch`/`useFetch`/REST routes (unless documenting the WS `withClaims` carve-out).

---

## Breaking a Monolithic Spec into Per-Page Files

If a module has a single `*.spec.md` file that needs to be split:

1. Create the directory structure mirroring the page tree
2. Create `_shared.data.md` — extract: data types, DB schema, permissions, shared mutations
3. For each page: create `{page}.ui.md` (layout/components/interactions) and `{page}.data.md` (API/queries/mutations)
4. Per-page data files reference `_shared.data.md` rather than repeating types
5. Delete the monolithic file after all page files are verified complete

The UI/data split is motivated by the possibility of changing the data layer (e.g. transport, query strategy)
without touching UI specs — keep these concerns strictly separated.

---

## Status Lines

Every spec file starts with a status line:

```
## Status
Implemented — reverse-engineered from the existing codebase.
```
or
```
## Status
Draft — fill in all [FILL IN] sections before implementing.
```
or
```
## Status
Placeholder — not yet implemented.
```

Update the status when the state changes.
