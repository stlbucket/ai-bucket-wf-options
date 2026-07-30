# Plan: Introduce `fnb-types` as the shared source-of-truth types package

## Context

Today, global-rules **R3** makes the codegen output in `packages/graphql-client-api/src/generated/fnb-graphql-api.ts` the source of truth for all types, and forbids hand-writing anything that duplicates a generated GraphQL type. This has two problems:

- **The generated types are a poor sharing currency.** Every field is `Maybe<T>`, every selection carries a required `__typename`, custom scalars (UUID / Datetime / JSON) are typed `any`, and the shapes are coupled to urql/GraphQL. `db-access` (which reads raw `pg`, not GraphQL) already had to hand-write its own types (`src/types/profile-claims.ts` etc.) precisely to avoid inverting the dependency direction and inheriting `Maybe<>`/`__typename`.
- **Reshaping is ad-hoc and inconsistent.** Across the 21 composables, entity shaping is done three different ways: raw `*Fragment` passthrough (wf, todo, location, support), named local view types (`MsgTopic`, `TenantSummary`, `ProfileResidency`), and anonymous inline object shapes (admin licenses/subscriptions). The UI imports ~25 distinct generated symbols directly.

**The change:** invert R3. Introduce a new leaf package **`@function-bucket/fnb-types`** that holds plain, decoupled, framework-agnostic TypeScript types — the single vocabulary shared across the stack. GraphQL generated types become an *implementation detail* hidden behind explicit **mappers** inside `graphql-client-api`. The UI and `db-access` know **only** `fnb-types`.

**Intended outcome:** one flat, reactivity-free, dependency-free type vocabulary; codegen output consumed only internally by mappers; the UI structurally unable to import a generated GraphQL type.

## Locked decisions

| # | Decision |
|---|----------|
| Rollout | Scaffold package + establish mapper convention + migrate **one full vertical (Resident) end-to-end as the reference**, then a rollout checklist for the remaining entities. |
| Timestamps | `Date` in `fnb-types`. `db-access` already yields `Date` (no change); GraphQL-tier mappers do `new Date(str)`. |
| Enums/unions | **All** status/enum types are pure string-literal unions (`type X = 'a' \| 'b'`). No runtime data in `fnb-types`. The two current runtime enum call sites are converted to type-guarded string literals. |
| Barrel enforcement | **Hard cutover at the end:** remove `export * from './generated/fnb-graphql-api'` from the `graphql-client-api` barrel; re-export only the generated urql hooks the UI genuinely uses. |
| Package nature | `fnb-types` is **strictly type-only** — zero logic, functions, or runtime values. Pure normalization + thin decoupling from the GraphQL API. |
| Cross-source shapes | Do **not** force-unify. Where two sources describe genuinely different shapes (`db-access` `MessageWithSender` vs GraphQL `MsgMessage`) they stay as two distinct fnb-types. Only truly shared entities (Resident) share one type. Composite views compose sub-mappers (mappers calling mappers), one pass. |

## Architecture

**Dependency graph (unchanged direction, new leaf):**
```
fnb-types  (leaf, no workspace deps, type-only)
   ▲            ▲
   │            │
db-access   graphql-client-api ──▶ db-access
   ▲            ▲
   └──── UI (apps + layers) ──── knows ONLY fnb-types for entity types
```

**Mapper convention (new):** `packages/graphql-client-api/src/mappers/<entity>.ts`, one exported pure function per entity, `to<Entity>(fragment): <Entity>`. Composables import mappers and stop reshaping inline. Composite mappers call entity mappers.

## Phase 1 — Scaffold `@function-bucket/fnb-types`

- New package `packages/fnb-types/` following the `db-access` layout (`package.json`, `tsconfig.json`, `tsconfig.build.json`, `vite.config.ts` + `vite-plugin-dts`, `vitest.config.ts` with `passWithNoTests`).
- **Type-only build nuance:** since there is no runtime code, the emitted `dist/index.js` will be effectively empty but must still exist (`import type` erases at runtime, but the monorepo's `packages-watch` healthcheck and module resolution expect `dist/index.js` + `dist/index.d.ts`). Configure the build to emit both.
- `src/` — one file per entity/group, barrel `src/index.ts` re-exporting all (barrel-miss = ESM crash, same rule as the other packages).
- No workspace dependencies. `type: module`, name `@function-bucket/fnb-types`.
- **Infra:** add `fnb-types` to the `packages-watch` build order and its healthcheck **before** `db-access` and `graphql-client-api` (docker-compose.yml / packages-watch config) so containers don't start against a missing dist. Add `"@function-bucket/fnb-types": "workspace:*"` to `db-access` and `graphql-client-api` `package.json`.

## Phase 2 — Establish the mapper convention

- New dir `packages/graphql-client-api/src/mappers/`.
- Pattern: `export const toResident = (f: ResidentFragment): Resident => ({ ... })`. Pure, no reactivity. Un-`Maybe`, coerce scalars, `new Date(...)` timestamps, `.map(p => p.permissionKey)` flattening, nested composition via sub-mappers.
- Composables call mappers inside their existing `computed()` instead of inline reshaping.

## Phase 3 — Pilot: Resident, end-to-end (the reference implementation)

Resident is the pilot because it is the **only** core entity fed by *both* sources — proving the whole thesis in one slice.

1. **`fnb-types`:** move `db-access/src/types/resident.ts` → `packages/fnb-types/src/resident.ts` (`Resident`, `ResidentStatus`, `ResidentType`), timestamps stay `Date`. Add to barrel.
2. **`db-access`:** internal imports repoint from `@/types/resident` → `@function-bucket/fnb-types`; drop the `Resident*` type re-exports from `db-access/src/index.ts`. (`db-access` still produces `Date` from `pg` — no mapper change needed.)
3. **`graphql-client-api`:** add `src/mappers/resident.ts` (`toResident(ResidentFragment): Resident`). Rewrite `useAdminResidents` (`packages/graphql-client-api/src/composables/useAdminResidents.ts:15`) to return `Resident[]` via `toResident`; update the msg/todo `MsgResidentItem` shaping to compose `toResident` where applicable. Import `Resident` from `@function-bucket/fnb-types`.
4. **UI:** repoint the app-level shims and components that import `Resident` from `@function-bucket/fnb-graphql-client-api` to `@function-bucket/fnb-types` — representative sites: `apps/tenant-app/app/components/LicenseList.vue:64` (`residents: Resident[]` prop), resident admin pages/composables.
5. **Gate:** `pnpm -F @function-bucket/fnb-types build && pnpm -F @function-bucket/fnb-db-access build && pnpm -F @function-bucket/fnb-graphql-client-api build`, then `pnpm build` repo-wide. No TS errors.

## Phase 4 — Rollout (repeat the Phase 3 pattern per entity)

Backlog, grouped by module. For each: create the `fnb-types` type → write the mapper → update composable(s) to return the fnb-type → repoint UI imports.

- **db-access moves (type-only relocation):** `ProfileClaims`/`ModuleInfo`/`ToolInfo`/`ProfileStatus`, `Location`, `MessageWithSender`, `User`. Repoint `db-access` internals + `graphql-client-api/src/composables/useProfileClaims.ts:7` (currently imports `ProfileClaims` from `db-access`) to `fnb-types`.
- **app/admin:** `License`, `LicenseType`, `LicensePack`, `LicensePackLicenseType`, `LicenseTypePermission`, `TenantSubscription`, `Tenant`(→ from `TenantSummary`), `Profile`, `Application`, `Module`, `Tool`, `ProfileResidency` — replaces the inline anon shapes in `useAdminLicenses`/`useAdminSubscriptions`/`useAdminResident` and named views in `useSiteAdminTenants`/`useSiteAdminUsers`/`useResidency`.
- **msg:** `MsgTopic`, `MsgMessage`, `SubscribedTopicSummary` (+ `TopicSummary` alias), `MsgResidentItem`, `Subscriber` — composite `toMsgTopic` composes `toMsgMessage`/`toParticipant`.
- **loc/todo/wf/support:** `Location`, `Todo`, `Wf`, `Uow`, `UowDependency`, `SupportTicket`, `SupportTicketComment` — replaces raw-fragment passthrough.
- **All status enums → string-literal unions** in `fnb-types` (`ResidentStatus`, `LicenseStatus`, `TenantStatus`, `TenantType`, `TopicStatus`, `MessageStatus`, `SubscriberStatus`, `SupportTicketStatus`, `TodoStatus`, `TodoType`, `UowStatusType`, `UowType`, `WorkflowInputDataType`, etc.).
- **Two runtime-enum call sites converted to guarded string literals:**
  - `apps/graphql-api-app/app/components/WfQueueModal.vue:3` → `def.dataType === 'boolean'`.
  - `apps/graphql-api-app/app/pages/workflow/[id].vue:10` → `const active: UowStatusType[] = ['incomplete','waiting']; active.includes(...)`.
- **App-level re-export shims** that leak types (e.g. `apps/tenant-app/app/composables/useSupportTickets.ts:2`, `useSiteAdminTenants.ts:1`, `useTodoDetail.ts:2`, `apps/graphql-api-app/app/composables/useWfInstances.ts:1`, `packages/msg-layer/app/composables/useMsgTopics.ts:1`) repoint `export type { ... }` to `@function-bucket/fnb-types`.
- **Input types** (e.g. `LocationInfoInput`) used by UI forms: add plain input shapes to `fnb-types` where the UI currently imports a generated input type.

**Judgment call (noted, not a blocker):** `JwtPayload`/`JwtUserMetadata` (in `db-access/src/jwt.ts`) stay co-located with `buildJwtPayload`. They are snake_case JWT *serialization glue*, not shared normalized entities — moving them into a "clean shared types" package would pollute it. This is the one deliberate exception to "move every type out of db-access."

## Phase 5 — Hard cutover + spec update

- **Barrel:** remove `export * from './generated/fnb-graphql-api'` from `packages/graphql-client-api/src/index.ts`. Explicitly re-export only the generated urql hooks the UI actually imports as values (e.g. `useDiscussionByIdQuery`) — audit `apps/*` for direct generated-hook value imports first. Keep `export * from './composables/*'` and `export * from './mappers/*'` (if mappers are public). After this, no generated *type* is reachable from the package's public API.
- **Spec:** rewrite **R3** in `.claude/specs/global-rules.md` to state the new rule (fnb-types is the source of truth; generated types are internal to graphql-client-api mappers; UI/db-access use fnb-types only). Add `fnb-types` to `.claude/specs/package-layers-pattern.md` (seven → eight packages) and update the package roster in `.claude/skills/fnb-stack-implementor/SKILL.md` + `CLAUDE.md`.

## Critical files

- New: `packages/fnb-types/**` (package + `src/<entity>.ts` + `src/index.ts`).
- New: `packages/graphql-client-api/src/mappers/**`.
- Edit: `packages/db-access/src/index.ts` (drop moved type re-exports), `db-access` internal type imports, `db-access/package.json`.
- Edit: `packages/graphql-client-api/src/index.ts` (barrel cutover), `src/composables/*` (use mappers), `graphql-client-api/package.json`.
- Edit: ~40 UI files across `apps/tenant-app`, `apps/graphql-api-app`, `apps/auth-app`, `apps/msg-app`, `packages/msg-layer` (repoint type imports).
- Edit: `docker-compose.yml` / packages-watch config + healthcheck; `.claude/specs/global-rules.md` (R3), `.claude/specs/package-layers-pattern.md`, `CLAUDE.md`.

## Verification

- **Gate is `pnpm build`** (repo-wide `pnpm lint` is known-broken — memory `project_eslint_broken`). Build order: `fnb-types` → `db-access` → `graphql-client-api` → apps. Zero TS errors, especially in the `defineProps`/`ref<>`/`computed<TableColumn<T>[]>` sites where types are structurally load-bearing.
- **Barrel sanity:** after Phase 5, grep `apps/` + layer packages for `import type { ... } from '@function-bucket/fnb-graphql-client-api'` → should return **zero** entity-type hits (only value/hook imports remain). Grep for `from '@function-bucket/fnb-types'` → present in the migrated UI sites.
- **Runtime:** Docker uses named `node_modules` volumes, so a local `pnpm install` does not reach containers. **Do not rebuild/restart the environment myself — stop and ask the user** (memory `feedback_rebuild_ask_user`), then do read-only verification: pages render, `POST /graphql-api/api/graphql` fires with expected operations, no ESM `does not provide an export named 'X'` crash at `dist/index.js` (the barrel-miss signature), no console errors on the pilot (Resident) admin pages.
- **Pilot acceptance:** `useAdminResidents` returns `fnb-types` `Resident[]`; `LicenseList.vue` and resident admin pages typecheck against `fnb-types` `Resident`; `db-access` still builds and the WS carve-out (`selectMessageWithSenderById`) is unaffected.

## Risks / notes

- **Barrel misses crash at runtime, not build** — verify both new barrels (`fnb-types`, and the narrowed `graphql-client-api`) after every file add.
- **Generated hooks still needed as values** — the Phase 5 barrel narrowing must not drop urql hooks the UI imports directly; audit before removing `export *`.
- **`useProfileClaims` already consumes an external hand-written `ProfileClaims`** — it just repoints from `db-access` to `fnb-types`; low risk, good early move alongside the pilot.
- **Never run `git` in a sqitch session** and **never commit** (memory `feedback_never_commit_git`) — this refactor touches no DB/sqitch, but the no-commit rule stands.
