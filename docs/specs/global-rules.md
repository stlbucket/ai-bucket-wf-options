# Global Rules

Derived from patterns observed in the existing implementation; they apply to all modules and all
apps in the fnb monorepo. Each rule here is **statement + why only** — the mechanics live in the
owning pattern file, and an architecture change fixes the detail there once (see R21).
Canonical stack description: `graphql-api-pattern.md` (data path) + `package-layers-pattern.md`
(package internals).

---

## Data Access

### R1 — All data access goes through composables
Every read/mutation is a composable (`use{Domain}()`) wrapping a generated urql hook; feature
apps re-export the shared implementation from `packages/graphql-client-api`.
_Why:_ pages coupled to the transport can't be tested or re-targeted; the composable is the
boundary and the re-export keeps every app on one shared implementation.

### R2 — Components must not make API calls
Components take data via props. Sole exception: `Msg.vue` (owns its WebSocket lifecycle) — a
special case, not a pattern to copy.

### R3 — `fnb-types` is the shared type vocabulary; generated types are internal
Shared entity/view types live in `@function-bucket/fnb-types` (plain, flat, no `Maybe<>`;
UUID→`string`, Datetime→`Date`; enum values mirror GraphQL enums UPPERCASE). Generated GraphQL
types are internal to `graphql-client-api`, bridged by mappers (`src/mappers/<entity>.ts`,
`to<Entity>(fragment)`); the barrel never re-exports the generated module, so the UI is
structurally unable to import a generated type. If a field is missing, expand the `.graphql`
fragment — never trim the fnb-type. Full mapper convention + the lowercase-JSON boundary
exception: `package-layers-pattern.md`.

### R4 — Composable-shaped view types live in `graphql-client-api`, not in pages
Query-shaped view types belong next to the composable that produces them — never in the
app/page layer.

---

## Data Layer (default = GraphQL; REST/H3 is a carve-out)

### R5 — Default reads/mutations go through PostGraphile; RLS via `pgSettings`
`grafast.context()` turns `event.context.claims` into `pgSettings`
(`role: 'authenticated'` + `request.jwt.claims`, else `anon`) — there is no per-route
`withClaims` on this path. `withClaims(claims, fn)` (2-arg, `db-access`) is the narrow
carve-out for authorized server work outside GraphQL; the pre-claims functions stay raw `pg`.
Mechanics + the full carve-out inventory: `graphql-api-pattern.md`.

### R6 — Surface auth/absence errors explicitly on the H3 carve-out
H3 endpoints throw `401` when claims are missing and `404` when a required record is absent —
never a silent `null`. On the GraphQL path, handle `error`/`fetching` from the urql hook
(error table: `graphql-api-pattern.md`).

### R7 — Server code is thin — no business logic
H3 handlers and grafast hooks call query/mutation functions and return. Business logic belongs
in `<module>_fn.*`, gated by `<module>_api.*`.

---

## Database

### R8 — All mutations follow the `<module>_api` → `<module>_fn` two-layer pattern
`_api` = SECURITY INVOKER, `jwt.enforce_permission` first, the PostGraphile mutation surface;
`_fn` = SECURITY DEFINER internal logic, no permission check of its own.

### R9 — All tables have RLS enabled
Every new table gets `enable row level security` plus at minimum a `jwt.*()`-based policy.

### R10 — All DB changes go through sqitch
No ad-hoc DDL. Every change has deploy + revert + verify files.

### R11 — Generated GraphQL types are codegen output; regenerate, don't edit
If a generated type is wrong, fix the `.graphql` document (or the schema/smart tags) and re-run
codegen.

---

## Permissions

### R12 — Permission enforcement happens at the DB layer
`_api` gates + RLS are the enforcement; the TypeScript/GraphQL layers rely on
`pgSettings`/`withClaims` and never re-implement checks.

### R13 — Client-side permission checks are UI hints only
Hiding a button is fine; the DB must also enforce it.

### R14 — Navigation is registered in the DB, not hardcoded
Module/tool rows live in `db/fnb-app/deploy/00000000010240_app_fn.sql`; nav renders from
`ProfileClaims.modules`.

---

## Module Structure

### R17 — Follow the existing module directory structure
Feature modules have **no `server/` directory** — the only `server/` dirs are the H3 carve-outs
(graphql-api-app transport, msg-layer WS, storage-layer upload). Mirror an existing module; the
file tree per layer: `graphql-api-pattern.md` → What Lives Where, and the implementor's
`new-feature-checklist.md`.

### R22 — n8n is the sole workflow engine
Self-hosted container trio, own host port, state in the separate `n8n_engine` DB; graphile-worker
and the agentic engine are retired. Invariants: fnb → n8n is **webhook-only** (secret header,
respond-immediately); n8n → fnb is the **`n8n_worker` PG role calling granted functions only**
(never PostGraphile); **definitions are code** (`n8n/workflows/*.json`, imported at boot; the
shared `error-handler` must be active); **security-bearing transitions are fixed node graphs**
(no model in the loop). Trigger routing lives only in the `triggerWorkflow` plugin's
`WORKFLOW_REGISTRY`. Full detail: `docs/specs/n8n-parallel-engine/` +
`docs/specs/agentic-decommission/` + `monorepo-bootstrap-pattern.md`; operator loop: skill
`n8n-cli`.

---

## UI / Components

See `ui-components-rules.md` for the full UI rules (UC1–UC12, UC14, UC15; UC13 is reserved for
form validation — see that file's Known Gaps).

---

## Specs

### R18 — Every page has a `.ui.md` and a `.data.md` spec
UI concerns and data concerns live in separate files so either layer can change alone.

### R19 — Shared types and permissions live in `_shared.data.md`
Defined once per module, referenced from per-page `.data.md` files — not duplicated.

### R20 — Forward-looking specs use `[FILL IN]` markers
All must be resolved before implementation begins. Reverse-engineered specs are authoritative
and use **Known Gaps** instead.

---

## Change Management

### R21 — Architecture changes propagate to specs + skills in the same change
The stack is described in exactly three places: `global-rules.md`, the affected pattern file,
and the two orchestrator skills — plus any specialist skill documenting the affected area
(roster: `.agents/skills/skill-map.md`). Update all affected ones **together**. Skills
**reference** the pattern files and never re-describe the stack inline — the blessed shape is a
thin `SKILL.md` (gates, sequence, decision guide) with per-topic `references/*.md` files loaded
on demand; that duplication ban is what prevents drift (see the 2026-07 audits).

### R23 — Issue/plan artifacts follow the `docs/issues/` lifecycle + naming
Four directories (`identified` → `in-flight` → `addressed`, plus `recurring`); an item advances
by **moving**, status is never in the filename; fixed-width names
`[####]__[category]__[title-slug]__[SEV]__.plan.md`; every plan leads with a self-referential
Execution Directive. Full convention (widths, enums, examples): `docs/issues/README.md`.

---

## Workspace Dependencies

### R24 — Every package declares its own dependencies; layers are self-preparable TS projects
Each package's own `package.json` declares every bare specifier its source/config resolves
(pnpm does not hoist). One version per external package repo-wide via the pnpm default catalog
(`"catalog:"`); `latest`/`*` banned outside `peerDependencies`. Layers declare their parent,
import `h3` explicitly in `server/`, and carry their own `tsconfig.json` + `nuxt prepare`.
Gate: `pnpm dep-audit` (hard-fail). Full pattern:
`workspace-dependency-integrity-pattern.md`.

---

## Known Gaps (rules to add once resolved)

- Client-side error taxonomy — the transport now surfaces real `<module>_api` messages + pg
  fields (`graphql-api-pattern.md` → Error surfacing, 2026-07-30), but mapping
  `errcode`/messages to typed UI errors (instead of string matching) has no convention yet
- Pagination convention — no standard established yet
- Form validation — no standard library or pattern chosen (reserved as UC13)
- Optimistic UI updates — not yet used anywhere
