# Global Rules

Derived from patterns observed in the existing implementation.
These rules apply to all modules and all apps in the fnb monorepo.

The canonical description of the data stack is `.claude/specs/graphql-api-pattern.md`
(default path) plus `.claude/specs/package-layers-pattern.md` (package internals). These
rules reference those docs — they do not restate the stack. When an architecture detail
changes, fix it in one place there and update the references (see **R21**).

---

## Data Access

### R1 — All data access goes through composables
Pages and components never talk to the transport directly. Every read/mutation is encapsulated
in a composable (`use{Domain}()`) that wraps a generated urql GraphQL hook. In feature apps
(e.g. `tenant-app`) the app-level composable is a **thin re-export** of the real implementation
in `packages/graphql-client-api/src/composables/` — the page calls it via Nuxt auto-import and
never sees the transport.

_Why:_ Pages coupled to the transport can't be tested or re-targeted. The composable is the
boundary; the re-export keeps every app on one shared implementation.

### R2 — Components must not make API calls
A component that accepts data via props and renders it is always preferable to one
that fetches its own data. The sole exception is `Msg.vue` (which owns its WebSocket
lifecycle) — treat that as a special case, not a pattern to copy.

### R3 — `@function-bucket/fnb-types` is the shared type vocabulary; generated types are internal
Entity/view types shared across the stack live in **`@function-bucket/fnb-types`** — plain, flat,
framework-agnostic interfaces (no `Maybe<>`, no `__typename`, custom scalars resolved: UUID→`string`,
Datetime→`Date`). **The UI and `db-access` import types ONLY from `@function-bucket/fnb-types`.**

The generated GraphQL types (`packages/graphql-client-api/src/generated/fnb-graphql-api.ts`) are an
**implementation detail internal to `graphql-client-api`**. They are consumed only by **mappers**
(`src/mappers/<entity>.ts`, one pure `to<Entity>(fragment): <Entity>` per entity) that convert a
generated fragment into its `fnb-types` shape. Composables call mappers and return `fnb-types`; they
never expose a generated type name to the UI. The barrel does **not** re-export the generated module
(only the handful of urql hooks the UI needs as values) — so the UI is structurally unable to import
a generated type. → `package-layers-pattern.md` (fnb-types + mapper convention).

**Enum values in `fnb-types` mirror their GraphQL enum values verbatim (UPPERCASE, e.g.
`'ACTIVE'`)** so mappers pass enum values straight through. Exception: values that arrive as raw
`pg` strings inside a JSON payload (e.g. `ProfileClaims.profileStatus` from `current_profile_claims`,
`siteUserById`) are lowercase — normalize at the boundary that produces the fnb-type (db-access
uppercases `profileStatus`; the untyped `siteUserById` JSON stays raw/lowercase).

If a needed field is missing, **expand the `.graphql` fragment to select it** and re-run codegen —
never trim the fnb-type or reintroduce `Maybe<>` to match a thin fragment.

### R4 — Composable-shaped view types live in `graphql-client-api`, not in pages
Query-shaped view types (like `SubscribedTopicSummary`, `MsgResidentItem`) that a composable
assembles from the raw GraphQL response belong in
`packages/graphql-client-api/src/composables/<use…>.ts` alongside the composable that produces
them. Do not define response-shape types in the app/page layer.

---

## Data Layer (default = GraphQL; REST/H3 is a carve-out)

### R5 — Default reads/mutations go through PostGraphile; RLS via `pgSettings`
The default data path issues a urql GraphQL operation to `apps/graphql-api-app` (PostGraphile 5).
Auth is applied by `grafast.context()`, which reads `event.context.claims` and returns
`pgSettings` with `role: 'authenticated'` + `request.jwt.claims` (falling back to `role: 'anon'`).
PostGraphile then runs each operation under those settings so RLS fires. There is **no per-route
`withClaims` on this path** — the grafast context is its analog.

`withClaims(claims, fn)` (2-arg, in `packages/db-access`) is the **narrow carve-out** for
authorized server-side reads that run *outside* GraphQL — currently the msg-layer WebSocket
incremental message read. The pre-claims functions (`provisionIdpUser`, `profileClaimsForUser`,
`currentProfileClaims`) are the other carve-out: raw `pg` in `db-access`, run before claims exist.
(Authentication itself is ZITADEL's — OIDC code+PKCE; the `loginUser`/`auth.login_user` password
path is retired. See `future-auth/zitadel-login-pattern.md`.)

### R6 — Surface auth/absence errors explicitly on the H3 carve-out
On H3 endpoints (`graphql-api-app`, msg-layer WS read): throw `401` when `claims` is missing and
`404` when a required record is absent — never silently return `null`.
```ts
if (!claims) throw createError({ statusCode: 401 })
if (!result) throw createError({ statusCode: 404 })
```
On the GraphQL path, an unauthorized query resolves to `anon`/empty under RLS and permission-gated
mutations raise from `<module>_api` (surfaced as a GraphQL error) — handle `error`/`fetching` from
the urql hook in the composable.

### R7 — Server code is thin — no business logic
H3 handlers and grafast hooks call query/mutation functions and return the result. Business
logic belongs in `<module>_fn.*` PL/pgSQL functions, gated by `<module>_api.*`.

---

## Database

### R8 — All mutations follow the `<module>_api` → `<module>_fn` two-layer pattern
- `<module>_api.*` — SECURITY INVOKER entry point; calls `jwt.enforce_permission('p:…')` first,
  then delegates. This is the surface PostGraphile exposes as mutations.
- `<module>_fn.*` — SECURITY DEFINER internal logic; does the actual work, no permission check of its own.

### R9 — All tables have RLS enabled
Every new table must have `enable row level security` and at minimum a policy that
restricts access via the `jwt.*()` helpers (`jwt.tenant_id()`, `jwt.has_permission(key, tenant_id)`).

### R10 — All DB changes go through sqitch
No ad-hoc `ALTER TABLE` or manual schema changes. Every change has a deploy + revert + verify file.

### R11 — Generated GraphQL types are the internal codegen output; regenerate, don't edit
`packages/graphql-client-api/src/generated/*` is regenerated from the live PostGraphile schema
(`graphql-codegen`). Never edit it by hand. If a generated type is wrong, fix the `.graphql`
document (or the DB schema/smart tags behind PostGraphile) and re-run codegen. These generated
types are **internal to `graphql-client-api`** — the shared, hand-authored vocabulary is
`@function-bucket/fnb-types`, and mappers bridge the two (see R3).

---

## Permissions

### R12 — Permission enforcement happens at the DB layer
`<module>_api.*` functions call `jwt.enforce_permission('p:something')`, and RLS policies gate
row access. The TypeScript/GraphQL layers do not re-implement permission checks — they rely on
`pgSettings` (default path) or `withClaims` (carve-out) + RLS to enforce them.

### R13 — Client-side permission checks are UI hints only
Hiding a button because the user lacks `p:app-admin` is fine. That check must not be the
only enforcement — the DB must also enforce it.

### R14 — Navigation is registered in the DB, not hardcoded in components
Module and tool entries live in `db/fnb-app/deploy/00000000010240_app_fn.sql`.
The nav is driven by `ProfileClaims.modules` fetched at auth time (via GraphQL into localStorage).

---

## Module Structure

### R17 — Follow the existing module directory structure
When adding a new feature module in a feature app, there is **no `server/` directory** — the data
layer is GraphQL. Mirror an existing module:
```
db/<module>/deploy/*.sql                                     ← schema / _fn / _api / _policies (sqitch)
packages/graphql-client-api/src/graphql/<module>/{query,mutation,fragment}/*.graphql
packages/graphql-client-api/src/composables/use{Module}.ts   ← real composable (+ barrel export)
apps/<app>/app/composables/use{Module}.ts                    ← thin re-export
apps/<app>/app/pages/{module}/index.vue, [id].vue            ← call composables only
```
The only `server/` directories are the H3 carve-outs (`graphql-api-app` — the GraphQL transport;
`msg-layer` — WebSocket infrastructure; `storage-layer` — the multipart upload endpoint) and the
headless `agent-app` (R22).

### R22 — two workflow engines: agent-app (primary) + the parallel n8n container
The stack runs **two** workflow engines side by side, with **per-workflow engine assignment**
in exactly one place: the `WORKFLOW_REGISTRY` of the `triggerWorkflow` extendSchema plugin
(`apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts` — `{ key: { engine:
'agent' | 'n8n', permission } }`). Pages/composables are engine-agnostic (R1); moving a
workflow between engines is a registry edit plus the DB grants the workflow needs on the
target side. Per-engine run logs (`agent.workflow_run` / `n8n.workflow_run`) back the two
site-admin tools (Agentic Workflows / n8n Workflows, both `p:app-admin-super`).

**The agentic engine** is `apps/agent-app` (headless: no nginx route, no layers, no UI) — the
Claude Agent SDK harness running asset-scan + reaper, sync-breweries, and exerciser
(sync-airports moved to n8n 2026-07-20; its agentic definition is dormant in the tree as the
registry-flip rollback). Spec: `.claude/specs/agentic-workflow-engine/`.
The invariants:
- **fnb → agent is trigger-endpoint-only**: HTTP POST `${AGENT_INTERNAL_URL}/api/trigger/<key>`
  with the `X-Fnb-Trigger-Secret` header (callers: the `triggerWorkflow` extendSchema plugin in
  graphql-api-app, the storage-layer upload endpoint's post-commit POST, and the in-process
  reaper). Fire-and-forget `202 { accepted, runId }`; completion is observed via
  `agent.workflow_run`, never by holding the call open.
- **agent → fnb is the `agent_worker` PG role calling SECURITY DEFINER `_fn` functions, from
  tool handlers only.** agent-app never connects as authenticator/authenticated and never goes
  through PostGraphile. The model never sees a connection string and never writes SQL.
- **Toolboxes are closed**: custom zod-validated SDK MCP tools only — `tools: []` (disables all
  built-ins; `allowedTools` alone only gates permission, built-ins stay visible),
  `settingSources: []`, `allowedTools` = the `mcp__fnb__*` set. No Bash/FS/Web tools, no SQL tool.
- **Invariant-bearing transitions are single deterministic tools** (e.g. the scan verdict +
  promote/purge is ONE atomic `scan_and_resolve` tool); agents orchestrate, never adjudicate
  security verdicts. Deterministic recurring work (the reaper) is croner code, not an agent.
- **Terminal writes are harness-owned**: the injected `complete_run` tool hands resultData to
  the harness; begin/attach/complete/error/sweep DB writes happen only in harness code.

**The n8n engine** is a parallel container (official pinned image, own host port, state in the
separate `n8n_engine` DB in the existing cluster; inventory: `n8n-exerciser`, `error-handler`,
the `n8n-sync-breweries` twin, and the production `sync-airports` — moved 2026-07-20).
Spec: `.claude/specs/n8n-parallel-engine/`. Its invariants mirror the
agentic ones: **fnb → n8n is webhook-only** (`${N8N_INTERNAL_URL}/webhook/<key>` with
`X-Fnb-Webhook-Secret`, respond-immediately, no runId); **n8n → fnb is the `n8n_worker` PG
role calling granted functions only** (never PostGraphile, never authenticator); workflow
definitions are code (`n8n/workflows/*.json`, imported at boot; the shared `error-handler` —
which must be **active** — turns any failure into a terminal `n8n.workflow_run` error row).

No graphile-worker anywhere. See `monorepo-bootstrap-pattern.md` → Headless apps.

---

## UI / Components

See `.claude/specs/ui-components-rules.md` for the full UI rules (UC1–UC12).

---

## Specs

### R18 — Every page has a `.ui.md` and a `.data.md` spec
UI concerns (layout, components, interactions) and data concerns (GraphQL operations, composables,
mutations) live in separate files. See `.claude/specs/graphql-api-pattern.md` for the data-file
convention. Some modules also use `_overview.md` and `.future.md` shapes — those are additive.

### R19 — Shared types and permissions live in `_shared.data.md`
Data types and the permission model that span multiple pages in a module are defined once
in `_shared.data.md` and referenced from per-page `.data.md` files — not duplicated.

### R20 — Forward-looking specs use `[FILL IN]` markers
Unresolved decisions in a draft spec are marked `[FILL IN]`. All `[FILL IN]` blocks
must be resolved before implementation begins. Reverse-engineered specs are authoritative and
use **Known Gaps** for real gaps instead of `[FILL IN]`.

---

## Change Management

### R21 — Architecture changes propagate to specs + skills in the same change
The stack is described in exactly three places: `global-rules.md`, the affected pattern file
(`graphql-api-pattern.md` / `package-layers-pattern.md` / `sockets-pattern.md` /
`monorepo-bootstrap-pattern.md`), and the two orchestrator skills (`fnb-stack-spec`,
`fnb-stack-implementor`). Any change to how the stack works must update all affected ones
**together** — plus **any specialist skill that documents the affected area** (roster:
`.claude/skills/skill-map.md`; e.g. an auth change touches `fnb-db-designer`, a deploy-script
change touches `sqitch-expert`/`new-db-package`). The skills **reference** the pattern files;
they must never re-describe the stack inline (that duplication is what caused the last round
of drift — and the 2026-07-09 skill audit found five specialist skills stale for the same reason).

### R23 — Issue/plan artifacts follow the `.claude/issues/` lifecycle + naming convention
Durable work items live under `.claude/issues/` in four directories:
- `identified/` — found, not yet started (future finds land here)
- `in-flight/` — actively in planning / spec-update / implementation
- `addressed/` — fully done; never reused (move here only with user sign-off — see
  `feedback_ask_before_moving_addressed`, do not auto-file)
- `recurring/` — periodic playbooks that never "finish" (e.g. dead-code sweep, spec reconciliation,
  skill tune-up, RLS/permission audit)

An item advances by **moving between directories**; status is never encoded in the filename.

**Filenames** — `__` (double-underscore) between fields; **fixed-width, right-padded with `_`** so
every filename is the same length up to `.plan.md` and columns line up in a plain `ls`. Kebab-case
(`-`) within a field, so a slug's own hyphens stay visually distinct from the `_` padding.
- one-shot: `[####]__[category]__[title-slug]__[SEV]__.plan.md`
  — field widths **4 / 8 / 30 / 3** (rank / category / slug / severity).
- recurring: `[####]_recur__[title-slug].plan.md` — the `####` prefix (width 4, gapped by 10,
  starting at `0010_`) is the **execution order** for a housekeeping pass, not a priority rank;
  no severity — recurring playbooks are never closed.

- `####` = **priority rank** (lower = higher priority), width 4, gapped by 10 so items can be
  inserted between ranks. It is reassignable, so it is **not** a stable identifier — the `title-slug`
  is.
- `category` (width 8, the longest enum member) from the closed enum: `auth · app · msg · wf · loc ·
  storage · db · graphql · security · infra · testing · skills · specs · docs`.
- `title-slug` (width 30) is stable across moves and renumbering.
- `SEV` (width 3) from the closed set `CRT · HI · MED · LOW` — the item's severity, recorded in the
  filename so it is scannable without opening the file. No compound values (no `LOW-MED`); pick the
  nearer bucket.

Example (padding shown): `0010__auth______session-cookie-signing__________CRT__.plan.md`.

Each plan file leads with a **self-referential Execution Directive** — it names *this* file
(`<this-file>` / "this plan"), never a hardcoded `identified/…` path, so the invocation never goes
stale when the file moves between directories or is renumbered. A `recurring/` run may spawn new
numbered `identified/` items when it finds work.

---

## Workspace Dependencies

### R24 — Every package declares its own dependencies; layers are self-preparable TS projects
Every workspace package declares, in its **own** `package.json`, every external bare specifier
its source and config files resolve — including type-only imports, `modules:`/`extends:` entries,
CSS-consumed packages, and `vite.optimizeDeps.include` entries (which resolve from the consuming
**app's** context, so each app declares them). pnpm is fully isolated here (no hoisting) —
undeclared imports only work by accident of bundler resolution and surface as IDE-only TS errors.

Nuxt layers additionally: declare their parent layer (the `extends` target), import `h3`
utilities **explicitly** in `server/` code (no Nitro auto-imports there), and carry their own
`tsconfig.json` + `nuxt prepare` scripts so the IDE resolves auto-imports against the layer's
own manifest.

**Version alignment:** one version per external package, repo-wide, declared once in the pnpm
**default catalog** (`catalog:` in `pnpm-workspace.yaml`); any package used by more than one
manifest is declared `"catalog:"` in `dependencies`/`devDependencies`. `peerDependencies` are
never catalogued (deliberate wide ranges); `latest`/`*` specifiers are banned outside
`peerDependencies`; `pnpm.overrides` is reserved for forcing transitive copies (`h3`) and is
bumped together with its catalog entry. Enforced by `pnpm dep-audit` (hard-fail).

Full pattern, audit findings, purge lists, and the `dep-audit` enforcement script:
`.claude/specs/workspace-dependency-integrity-pattern.md`.

---

## Known Gaps (rules to add once resolved)

- Error handling strategy for `<module>_api` permission failures surfaced through GraphQL
- Pagination convention — no standard established yet
- Form validation — no standard library or pattern chosen
- Optimistic UI updates — not yet used anywhere
