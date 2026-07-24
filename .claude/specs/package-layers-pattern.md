# Package Layers Pattern

This document describes the ten shared packages that every app is built on top of. These are
not specced per-feature — they are the scaffold that features live inside of. Read this when
recreating any package from scratch or when understanding what a layer provides.

The ten: **type-only leaf** `fnb-types`; **compiled libs** `auth-server`, `auth-ui`, `db-access`,
`graphql-client-api`; **Nuxt layers** `auth-layer`, `tenant-layer`, `msg-layer`, `storage-layer`,
`game-layer`. (`db-types` — the retired Kysely/Kanel package — has been replaced by `db-access` +
`graphql-client-api`. See `.claude/specs/graphql-api-pattern.md` for the data stack.)

A separate, eleventh package — **`game-engines`** — is *not* one of the ten: it is pure TS,
vitest-covered, with **no runtime app consumer**. It holds the game-server referee/engine logic
(spec `.claude/specs/game-server/`); its build output is embedded verbatim into the `game-event`
n8n workflow's Code nodes by an embed script, never imported by a layer or app.

**`fnb-types` is the shared type vocabulary** (global-rules R3): the UI and `db-access` import
entity/view types only from it; generated GraphQL types are internal to `graphql-client-api` and
reached only through **mappers**. Dependency direction (a new leaf; nothing depends *out* of it):
```
fnb-types  (leaf, type-only, no workspace deps)
   ▲                    ▲
db-access        graphql-client-api
   ▲                    ▲
   └──────── UI (apps + layers) ── knows ONLY fnb-types for entity types
```

**Dependency declaration (global-rules R24):** every package declares every external bare
specifier it resolves, and any external package used by more than one manifest is versioned once
in the pnpm **default catalog** (`catalog:` block in `pnpm-workspace.yaml`) and declared as
`"catalog:"` in the manifest. Adding a dependency that another package already uses = reference
the catalog entry; adding a brand-new shared dependency = add the catalog entry first.
`peerDependencies` stay as wide compatibility ranges and are never catalogued. Full policy +
enforcement (`pnpm dep-audit`): `.claude/specs/workspace-dependency-integrity-pattern.md`.

---

## Layer Inheritance Chain

```
auth-layer          ← base layer: Nuxt UI, auth composable, login UI
    └── tenant-layer    ← adds nav system, dashboard layout, tenant UI
            ├── msg-layer       ← adds WebSocket + msg server infrastructure
            ├── storage-layer   ← adds asset upload endpoint + asset UI
            └── game-layer      ← adds WebSocket + game-notify server infrastructure (msg-layer mirror)
```

Every routed app extends one of these layers. `auth-app` extends `auth-layer`. `home-app`,
`tenant-app`, and `graphql-api-app` extend `tenant-layer`. `msg-app` extends `msg-layer`.
`storage-app` extends `storage-layer`. `game-app` extends `game-layer` (headless-ish: no
user-facing pages — it exists only to serve `/game/_ws/games/[id]`; the game UI lives in
tenant-app, exactly as msg-app's WS serves tenant-app's `/tenant/msg` pages). The exception is
the headless `agent-app`, which extends **no layer** (no pages, no auth middleware — the
Claude Agent SDK harness; see `monorepo-bootstrap-pattern.md` → Headless apps; the retired
`worker-app`/graphile-worker this section used to describe is gone — R22).

---

## Compiled Packages (built to `dist/`)

These packages compile TypeScript/Vue to `dist/` and are consumed as regular npm packages by
layers and apps. They must be built before apps start — the `packages-watch` Docker service builds
them in dependency order (`fnb-types` first) and its healthcheck waits for each `dist/index.js`.

### `packages/fnb-types`
**Package name:** `@function-bucket/fnb-types`
**Purpose:** The shared, framework-agnostic **type vocabulary** for the whole stack (global-rules
R3). Plain flat interfaces + string-literal-union enums — **type-only** with one
spec-authorized runtime exception: the pure, zero-dep URN helpers `parseUrn`/`formatUrn`/`isUrn`
in `urn.ts` (urn-registry spec). Zero workspace deps. UUID→`string`, Datetime→`Date`, enum
values mirror the GraphQL enum values (UPPERCASE). One file per entity/group (`resident.ts`,
`profile-claims.ts`, `license.ts`, `tenant.ts`, `workflow.ts`, `urn.ts`, …), re-exported from
`src/index.ts` (barrel-miss = ESM crash, same rule).
**Build:** Vite (`vite-plugin-dts`) — the emitted `dist/index.js` carries only the URN helpers
(everything else erases as `import type`); it must exist for the `packages-watch` healthcheck +
module resolution.
**Depends on:** nothing. **Used by:** `db-access`, `graphql-client-api`, and every app/layer that
names an entity type.

### `packages/auth-server`
**Package name:** `@function-bucket/fnb-auth-server`
**Purpose:** Server-side PostgreSQL client factory.
**Build:** Vite to `dist/index.js` + `dist/index.d.ts`.
**Source files:**
- `src/index.ts` — re-exports
- `src/use-pg-client.ts` — exports `pool`, `doQuery`, and `useFnbPgClient` (raw `pg` access from a
  connection string)

**Used by:** nothing — its last consumers (worker-app's graphile-worker handlers, then the
auth-app ping scaffolding) are retired. Candidate for removal: see
`identified/0350__infra_____retire-auth-server-package______LOW__.plan.md`.

---

### `packages/auth-ui`
**Package name:** `@function-bucket/fnb-auth-ui`
**Purpose:** Compiled Vue composable for client-side auth state.
**Build:** Vite (with `@vitejs/plugin-vue`) to `dist/index.js` + `dist/index.d.ts`.
**Source files:**
- `src/index.ts` — re-exports `useAuth` + `useResidencySwitcher`
- `src/use-auth.ts` — `useAuth()` composable: stores `ProfileClaims` in **localStorage** via
  VueUse `useStorage('auth.user', …)` (SSR-safe), exposes `user`, `isLoggedIn`, and
  `login`/`logout`/`changePassword`/`exitSupport`/`switchResidency`/`refreshClaims`. Claims are **not** read from a
  cookie — they are fetched from GraphQL (`fetchProfileClaims`) and mirrored to localStorage
  (the full JSON overflowed the `Set-Cookie` header → nginx 502). The httpOnly `session` cookie
  stays the auth root of trust. `refreshClaims`/`exitSupport` reach the urql client via
  `useNuxtApp().$urqlClient`. `logout` clears local claims in a `finally` (deterministic even
  when the revocation POST rejects — 0180 Tier 1).
- `src/use-residency-switcher.ts` — `useResidencySwitcher()`: derives the workspace-switcher
  tree (`roots: ResidencySwitchNode[]`, `isCurrent`/`canEnter` via the shared
  `ENTERABLE_STATUSES`) purely from `ProfileClaims.residencies` in localStorage; re-exposes
  `switchResidency` (spec: `.claude/specs/workspace-switcher/`).

**Depends on:** `@function-bucket/fnb-graphql-client-api` (claims fetch + `exitSupportMode`),
`@function-bucket/fnb-types` (the `ProfileClaims` type), `@vueuse/core`.
**Used by:** `auth-layer` (imported in components and the `useAuth` composable re-export).

---

### `packages/db-access`
**Package name:** `@function-bucket/fnb-db-access`
**Purpose:** The pre-claims **root of trust** (raw `pg`) plus the few authorized server-side
reads that run *outside* GraphQL. This replaced the retired Kysely-based `db-types`.
**Build:** compiled lib (tsc/Vite) to `dist/`.

**Key files:**
- `src/index.ts` — the master barrel; **every** export must be listed here or Node ESM crashes at
  startup (`does not provide an export named 'X'` at `dist/index.js`) — a runtime crash, not a build error.
- `src/pool.ts` — owns a single `pg.Pool` from `DATABASE_URL` (connects as `authenticator`); a
  `query<T>(text, params)` helper; registers a `citext[]` type parser.
- `src/with-claims.ts` — **`withClaims(claims, fn)` (2-arg, no `db` param)**: opens a pg txn,
  `set local role authenticated`, `set_config('request.jwt.claims', payload, true)`, runs
  `fn(client)`. Carve-out for authorized reads outside GraphQL (currently the WS message read).
- `src/jwt.ts` — `buildJwtPayload(claims)` → the `request.jwt.claims` payload shape.
- `src/utils/camel-case.ts` — `camelCaseKeys` recursively camelCases `to_jsonb` snake_case keys
  (reproduces the retired Kysely `CamelCasePlugin`, incl. nested `modules[]`/`tools[]`).
- `src/mutations/` — the **pre-claims functions** (raw pg): `provisionIdpUser`
  (`app_fn.provision_idp_user` — ZITADEL OIDC callback provisioning; `loginUser`/`auth.login_user`
  is retired), the server-side-session trio (`session-refresh-pattern.md`): `createSession`
  (`app_fn.create_session`, OIDC callback), `claimsForSession` (`app_fn.claims_for_session` — the
  per-request choke point: validates the `auth.session` row, touch-renews, builds claims),
  `revokeSession` (`app_fn.revoke_session`, logout), plus the claims builders
  `profileClaimsForUser` (`app_fn.profile_claims_for_user`) and `currentProfileClaims`
  (`app_fn.current_profile_claims`). **Never migrate these to GraphQL** — they run before claims exist.
- `src/queries/msg.ts` — `selectMessageWithSenderById(client, id)`, the one RLS read (WS path,
  runs inside `withClaims`).
- `src/utils/normalize-claims.ts` — uppercases `ProfileClaims.profileStatus` (raw pg is lowercase;
  `fnb-types` mirrors the GraphQL enum, UPPERCASE) so server-assembled claims match the client path.
- **Types are imported from `@function-bucket/fnb-types`** (`ProfileClaims`/`ModuleInfo`/`ToolInfo`,
  `Resident`, `Location`, `MessageWithSender`, `Profile`). They used to live hand-written under
  `src/types/` here; they moved to the `fnb-types` leaf so the UI and db-access share one vocabulary.

**Depends on:** `@function-bucket/fnb-types` (all shared types), `pg`.
**Used by:** `auth-app` (OIDC callback provisioning + session), `auth-layer`/tenant-layer server
(claims bootstrap), `msg-layer` (WS read), `storage-layer` (upload endpoint).

---

### `packages/graphql-client-api`
**Package name:** `@function-bucket/fnb-graphql-client-api`
**Purpose:** The default data layer — typed urql/vue hooks generated from the PostGraphile schema,
plus the shared composables every feature app re-exports.
**Build:** Vite (`vite-plugin-dts`) to `dist/`. See also `.claude/specs/graphql-api-pattern.md`
(the data stack) and `.claude/specs/graphql-api-app/graphql-client-api-package.md`.

**Key files:**
- `codegen.ts` — schema `http://localhost:4000/graphql-api/api/graphql`, documents
  `src/graphql/**/*.graphql`, output `src/generated/fnb-graphql-api.ts` with plugins
  `typescript` + `typescript-operations` + `typescript-vue-urql`
  (`gqlImport '@urql/vue#gql'`, `arrayInputCoercion:false`, `nonOptionalTypename:true`); also
  emits `schema.json` + `schema.min.json`. Run: `pnpm -F @function-bucket/fnb-graphql-client-api generate`.
- `src/graphql/<module>/{query,mutation,fragment}/*.graphql` — hand-written operation documents.
- `src/generated/fnb-graphql-api.ts` — GENERATED typed hooks (`use<Op>Query`/`use<Op>Mutation`); do not edit.
- `src/mappers/<entity>.ts` — one pure `to<Entity>(fragment): <Entity>` per entity (global-rules
  R3). Un-Maybes, coerces scalars (UUID→`string`, Datetime→`Date`), passes enum values through
  (they already match `fnb-types`). Composite mappers call sub-mappers. **Internal — not barrel-exported.**
- `src/composables/use{Domain}.ts` — real composable implementations; wrap generated hooks, call
  mappers, return `fnb-types` shapes (`fetching`/`error`/computed data; no `refresh`). Composable-
  shaped **view** types (e.g. `SubscribedTopicSummary`, `SubscriptionPackDetail`) declared here (R4).
- `src/index.ts` — barrel: **does NOT `export *` the generated module** (that would leak generated
  types to the UI). Re-exports only the composables + the few generated urql hooks the UI needs as
  values (`useDiscussionByIdQuery`, `useUpsertMessageMutation`). Same missing-export ESM crash caveat.

**Depends on:** `@function-bucket/fnb-types` (shared types); peers `@urql/vue`, `vue`.
**Used by:** every feature app's `app/composables/` (thin re-exports) and `auth-ui`.

---

## Nuxt Layers

Nuxt layers are consumed via `extends: ['@function-bucket/fnb-<layer>']` in `nuxt.config.ts`.
They contribute `app/` directory files (pages, components, composables, layouts, middleware,
plugins) and optionally `server/` directory files (API routes, middleware, plugins, utils).

**Every layer is a self-preparable TypeScript project** (global-rules R24 —
`.claude/specs/workspace-dependency-integrity-pattern.md`): it has its own `tsconfig.json`
(app-style `files: []` + references into `./.nuxt/tsconfig.*.json`) and
`dev:prepare`/`postinstall: nuxt prepare` scripts, so the IDE resolves auto-imports, `#imports`,
and Nuxt UI types against the layer's **own** manifest instead of falling back to the root
tsconfig (the source of the phantom IDE-only errors). The layer `.nuxt` dirs are IDE-only
artifacts — gitignored, not needed in Docker. Layer `server/` code imports `h3` utilities
explicitly (never Nitro auto-imports); layer `app/` code may rely on auto-imports.

### `packages/auth-layer`
**Package name:** `@function-bucket/fnb-auth-layer`
**`main`:** `./nuxt.config.ts` (how Nuxt resolves the layer)
**Extends:** nothing (base layer)
**Provides:**
- `@nuxt/ui` module (green/slate theme via `app/assets/css/main.css`)
- `@iconify-json/lucide` and `@iconify-json/simple-icons` icons
- `runtimeConfig.authAppInternalUrl` (server-side URL to auth-app)

**App directory (`app/`):**
| File | Purpose |
|------|---------|
| `assets/css/main.css` | Tailwind + Nuxt UI theme (primary: green, neutral: slate) |
| `layouts/default.vue` | Minimal layout: `<main><slot /></main>` |
| `components/ChangePasswordForm.vue` | Password change form |
| `components/LoginForm.vue` | Login email/password form |
| `components/UserProfile.vue` | Profile display card |
| `composables/useAuth.ts` | Re-exports `useAuth()` from `@function-bucket/fnb-auth-ui` |
| `composables/useResidencySwitcher.ts` | Re-exports `useResidencySwitcher()` + `ResidencySwitchNode` from `@function-bucket/fnb-auth-ui` (workspace switcher) |
| `middleware/auth.ts` | Route middleware: redirects to login if not authenticated |
| `plugins/hydrate-claims.client.ts` | Revalidates the localStorage claims mirror on every app boot: refetch via GraphQL; stale (had claims, session dead) → clear + redirect `/?session=expired`; fetch error → keep last-known (`future-auth/claims-revalidation-pattern.md`) |

**Server directory (`server/utils/`):** provides the shared claims/cookie helpers (auto-imported):
| File | Purpose |
|------|---------|
| `applyEventClaims.ts` | `applyEventClaims(event)` → sets `event.context.{user,claims}`; declares the `H3EventContext` augmentation. Claims are NOT written to a cookie. |
| `getEventClaims.ts` | Unseals httpOnly `session` cookie (`readAppSession`) → `claimsForSession(sid)` (db-access) — validity from the `auth.session` row, fail closed |
| `session.ts` | Sealed session (issues 0010 + 0185): `appSessionConfig` / `setAppSession` / `readAppSession` / `clearAppSession` — h3 `useSession` + `NUXT_SESSION_SECRET` (≥ 32 chars, fail-closed); payload `{ id, sid }`; unseal failure = unauthenticated; the row is the validity authority, the seal's 7d maxAge is defense-in-depth |
| `auth-cookies.ts` | `deleteAuthCookies` — clears the sealed session + the legacy readable `auth.user` cookie |

The **per-request auth middleware** that calls `applyEventClaims` is registered by `tenant-layer`
(`server/middleware/auth.ts`, covers every tenant app) and by `auth-app` directly (it extends
auth-layer, not tenant-layer). There is no longer a `server/plugins/db.ts`/`createDb` — data
access is `db-access`'s own pg pool (default reads/mutations go through GraphQL, not this app's server).

---

### `packages/tenant-layer`
**Package name:** `@function-bucket/fnb-tenant-layer`
**`main`:** `./nuxt.config.ts`
**Extends:** `@function-bucket/fnb-auth-layer`
**Provides:** navigation system, dashboard layout, tenant-aware components

**App directory (`app/`):**
| File | Purpose |
|------|---------|
| `layouts/default.vue` | App shell: persistent desktop `<AppNav>` sidebar + slim mobile brand bar (`FunctionBucketMark`) + `<main>` (wrapping `<OtpSessionBanner>` + page slot) + `<AppNavMobile>` bottom bar/drawer |
| `pages/index.vue` | Placeholder landing (greeting + signed-in `user` dump, else a Login button) — the real dashboard grid lives in `home-app`, not here |
| `components/AppNav.vue` | Desktop sidebar (`lg:`+): brand, `<WorkspaceSwitcher>`, the `<ModuleNavSection>` list, and an inline user footer; whole-nav collapse to an icon rail persisted via `useAppNav` (`fnb:nav-collapsed`) |
| `components/AppNavMobile.vue` | Mobile (`<lg`) bottom tab bar + full-nav `USlideover` drawer; reuses `<ModuleNavSection>` + `<WorkspaceSwitcher>` |
| `components/ModuleNavSection.vue` | Renders one nav section from claims `modules`; expanded form is a per-section `UCollapsible` disclosure (spec `.claude/specs/nav-collapsible-sections/`), icon-only in the collapsed rail |
| `components/WorkspaceSwitcher.vue` | Sidebar current-tenant trigger + residency-tree `UModal`/`UTree`; mounted in `AppNav` + `AppNavMobile` (spec: `.claude/specs/workspace-switcher/`) |
| `components/FunctionBucketMark.vue` | Inline-SVG brand mark (bucket glyph + optional ƒb monogram; `primary`/`secondary` fill) |
| `components/OtpSessionBanner.vue` | Temporary-session countdown banner for OTP quick-login; polls auth-app `/api/session-info` (pre-claims, same-origin), renders only for `authMethod='otp'` (spec `.claude/specs/otp-login/`) |
| `components/Loc.vue` | Location display card (name + address lines + coords) from the `fnb-types` `Location` shape |
| `components/UserProfileStatus.vue` | Avatar + display name + logout/exit-support header widget — **present but currently unmounted** (`AppNav` renders its own inline user footer); dead-code-sweep candidate |
| `components/TemplateMenu.vue` | **Unused** — leftover Nuxt UI starter-template picker dropdown (scaffolding); dead-code-sweep candidate |
| `composables/useAppNav.ts` | Nav state from claims `modules` + mobile-drawer open/close + whole-nav-collapse + **per-section collapse** (top-3-open default, localStorage `fnb:nav-section:*`, spec `.claude/specs/nav-collapsible-sections/`) |

**Server directory (`server/middleware/`):**
| File | Purpose |
|------|---------|
| `middleware/auth.ts` | Calls `applyEventClaims(event)` (from auth-layer) on every request, for every app that extends tenant-layer |

No `plugins/db.ts`/`createDb` — the default data path is GraphQL; the pre-claims trio uses
`db-access`'s own pg pool.

---

### `packages/msg-layer`
**Package name:** `@function-bucket/fnb-msg-layer`
**`main`:** `./nuxt.config.ts`
**Extends:** `@function-bucket/fnb-tenant-layer`
**Enables:** `nitro.experimental.websocket: true`
**Special:** this layer provides app-layer UI plus the **WebSocket server infrastructure**. The
per-request auth middleware itself now lives in `tenant-layer` (`applyEventClaims`, shared by
every tenant app); msg-layer's `server/` is only the realtime/WS carve-out. The topic list,
topic create, message list/post, and resident list are **GraphQL** now (via `useMsgTopics` /
`useMsgResidents` in `graphql-client-api`), not REST routes.

**App directory (`app/`):**
| File | Purpose |
|------|---------|
| `pages/messages/index.vue` | Topic list page |
| `pages/messages/[id].vue` | Topic detail + real-time message thread |
| `components/TopicList.vue` | Topic list component |
| `components/MessageThread.vue` | Scrolling message thread |
| `components/MessageComposer.vue` | Text input + send button |
| `composables/useMsgTopics.ts` | Thin re-export of `useMsgTopics` from `graphql-client-api` |

**Server directory (`server/`) — WS carve-out only:**
| File | Purpose |
|------|---------|
| `plugins/pg-notify-bridge.ts` | LISTEN/NOTIFY → WebSocket peer fanout (see note below) |
| `routes/_ws/topics/[id]/messages.ts` | WebSocket handler: auth on upgrade, subscribe to pg channel |
| `utils/getWsUpgradeClaims.ts` | Parses cookies from a WS upgrade request → `claimsForSession(sid)` — same session-row validation as the HTTP middleware |
| `api/topics/[id]/messages/[msgId].get.ts` | Incremental "new message" read — `withClaims(claims, fn)` (2-arg) + `selectMessageWithSenderById` from `db-access` |

There is **no `plugins/db.ts`/`createDb`** and **no `middleware/auth.ts`** here anymore — db access
is `db-access`'s own pg pool, and auth middleware is `tenant-layer`'s `applyEventClaims`.

**pg-notify-bridge note:** There is a known h3 bug where the auth middleware (registered as
a non-lazy handler at the base path) intercepts WebSocket upgrade resolution before the router.
The bridge's `nitroApp` plugin overrides `h3App.websocket.resolve` to walk the handler stack
and find the `__resolve__` function on the router handler. This fix is baked into the bridge
plugin and must not be removed.

---

### `packages/storage-layer`
**Package name:** `@function-bucket/fnb-storage-layer`
**`main`:** `./nuxt.config.ts`
**Extends:** `@function-bucket/fnb-tenant-layer`
**Special:** provides the asset UI plus the **multipart upload endpoint carve-out** (multipart
can't ride GraphQL). No WebSocket. The asset-scan worker does **not** live here — all
graphile-worker handlers run in `apps/worker-app` (see `monorepo-bootstrap-pattern.md` →
Headless apps). `runtimeConfig.public.uploadUrl` defaults to
`http://localhost:4000/storage/api/upload` (full-URL style, like `graphqlApiUrl`).
Full spec: `.claude/specs/asset-storage/`.

**App directory (`app/`):**
| File | Purpose |
|------|---------|
| `pages/assets/index.vue` | `/storage/assets` — RLS-scoped asset list + ad-hoc uploader |
| `components/AssetUploader.vue` | Single-file upload (202/PENDING-aware); owns its POST (documented R2 exception) |
| `components/AssetList.vue` | Props-only asset table (scan/context badges, download when `downloadUrl` non-null) |
| `components/PageHeader.vue` | Duplicated from tenant-app (it lives in an app, not a layer, so it isn't inherited) |
| `composables/useAssetUpload.ts` | Layer-local REST upload composable (`$fetch`, 202 → `AssetMeta`) |
| `composables/useSiteAssets.ts` | Thin re-export of `useSiteAssets` from `graphql-client-api` |

**Server directory (`server/`) — upload carve-out only:**
| File | Purpose |
|------|---------|
| `api/upload.post.ts` | `POST /storage/api/upload` — auth → parse/validate → PutObject to `quarantine/` → `withClaims`: `storage_api.insert_asset` + `wf_api.queue_workflow('asset-scan', …)` in one txn → 202 |
| `lib/asset-validation.ts` | Context vocab maps, `ALLOWED_TYPES`, extension cross-check, magic-byte sniff |
| `lib/s3.ts` | Lazy memoized S3 client (`getS3()`) — PutObject at upload only (scan Get/Copy/Delete live in worker-app). Lazy so apps extending the layer without S3 creds (tenant-app) don't crash at boot on the env check; compose `${S3_*:?}` stays storage-app's boot guard |

---

### `packages/game-layer`
**Package name:** `@function-bucket/fnb-game-layer`
**`main`:** `./nuxt.config.ts`
**Extends:** `@function-bucket/fnb-tenant-layer`
**Special:** a direct msg-layer mirror — provides **only** the WebSocket server infrastructure
for the game server (spec `.claude/specs/game-server/`); no app-layer UI (the battleship
pages live in tenant-app; nothing in `game-layer/app/` beyond the Nuxt scaffold). Enables
`nitro.experimental.websocket: true`.

**Server directory (`server/`) — WS carve-out only:**
| File | Purpose |
|------|---------|
| `plugins/pg-notify-bridge.ts` | LISTEN/NOTIFY → WebSocket peer fanout — copied verbatim from msg-layer's bridge (generic, table-agnostic), including the `websocket.resolve` override for the same h3 auth-middleware-intercepts-upgrade bug (see msg-layer's note above) |
| `routes/_ws/games/[id].ts` | WebSocket handler: auth on upgrade (session cookie → claims), subscribes to `game:{id}:state` |
| `utils/getWsUpgradeClaims.ts` | Same session-cookie → `claimsForSession(sid)` pattern as msg-layer's |

No `plugins/db.ts`/`createDb` and no `middleware/auth.ts` — same as every tenant-layer
descendant (db access is `db-access`'s own pg pool; auth middleware is tenant-layer's
`applyEventClaims`).

---

## Codegen Workflow (GraphQL types)

There is no Kysely/Kanel `db-generate` step anymore. Types come from PostGraphile via codegen:
1. Ensure the PostGraphile API is running at `http://localhost:4000/graphql-api/api/graphql`.
2. Run `pnpm -F @function-bucket/fnb-graphql-client-api generate` (`graphql-codegen --config codegen.ts`).
3. Output: `packages/graphql-client-api/src/generated/fnb-graphql-api.ts` (+ `schema.json`,
   `schema.min.json`) — never edit by hand.
4. Rebuild the package: `pnpm -F @function-bucket/fnb-graphql-client-api build`.

`db-access` types are **hand-written** (source of truth for the pre-claims trio) — nothing to
generate there. `pnpm build` is the gate (repo-wide `pnpm lint` is known-broken).
