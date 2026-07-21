# Dev Startup Performance — Vite prebundle + route warmup

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

## Status

Implemented (2026-07-20, plan 0370). Dep list confirmed against dev-server logs; warmup active
on all six apps. The Execution Directive stays as the entry point for future extensions.

## Purpose

The user reports that most of the site "takes a while to load after startup — even if
everything has been pinged." Diagnosis (this conversation, 2026-07-20):

Every user-facing app runs **`nuxt dev`** (`docker-compose.yml` → `command: … nuxt dev …`,
`NODE_ENV=development`). In dev, Nuxt/Vite compiles **lazily, per-route, per-app**. Two
distinct costs produce the "slow after startup" feel:

1. **First-visit route compilation.** Pinging `/` (or a healthcheck) only warms that one
   route in that one app. Each app is a *separate* Vite process behind a Caddy path prefix
   (`auth-app`, `tenant-app`, `home-app`, `msg-app`, `storage-app`, `game-app`), so the first
   real visit to each app — and each route within it — pays its own cold-compile cost.
2. **Mid-request dependency re-optimization.** When a page imports a browser dependency Vite
   hasn't prebundled, Vite bundles it *during the request* and forces a **full page reload**
   (`✨ new dependencies optimized: …, reloading`). That reads as a multi-second freeze. Today
   only three deps are pinned in `optimizeDeps.include`, so heavy shared deps (Nuxt UI and its
   `reka-ui`/`tailwind-variants` base, `graphql`, `@urql/core`, date libs) get discovered
   on-demand.

This spec implements the two HMR-preserving mitigations (#2 and #3 from the diagnosis):

- **#2 — Expand `vite.optimizeDeps.include`** so heavy shared browser deps are prebundled at
  boot, eliminating the discover-and-reload freeze.
- **#3 — Add `vite.server.warmup.clientFiles`** so each app's page module graph is transformed
  at server startup instead of on first click.

Both settings are **dev-server-only** — Vite ignores `optimizeDeps` and `server.warmup` during
`nuxt build`, so there is **zero production/build impact** and no env gating is needed.

**Out of scope** (diagnosis items #1 and #4): switching to a production build for QA sessions,
and a post-startup `curl` warmup script that pings a route per app. Not requested here.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Where both settings live | **`packages/auth-layer/nuxt.config.ts`** — the single existing `vite` block | `auth-layer` is the universal root of the extends chain (`auth-app`→`auth-layer`; all others→`tenant-layer`→`auth-layer`). Nuxt merges layer `vite` config via defu (arrays concat), so one edit propagates to all six apps. It already owns the only `optimizeDeps.include`. |
| Scope of `optimizeDeps.include` | Browser/shared deps only | `optimizeDeps` prebundles the *browser* dep graph. Server-only deps (`pg`, `@aws-sdk/client-s3`, `nitropack`, `h3`) are irrelevant and must not be added. |
| Dep list source of truth | **Dev-server logs**, seeded from the candidate list in `implementation.md` | The authoritative list is whatever Vite prints as `new dependencies optimized: …`. The candidate list is reasoned from the layer-chain `package.json` deps; the implementor confirms/prunes against real log output. |
| Warmup glob | `./app/pages/**/*.vue` (resolved per-app against each app's `rootDir`) | Catches each app's own pages (the bulk — `tenant-app` has 36). Resolves correctly from `auth-layer` because Vite resolves `server.warmup.clientFiles` against the *consuming app's* root, not the layer's. |
| Layer-provided pages (`msg-layer`, `storage-layer`, `tenant-layer`) | **Deferred**, not warmed | Their `.vue` live under `node_modules/@function-bucket/*-layer/app/pages` in the container — a version-fragile glob. Small set; add explicitly only if profiling shows a cold hot-path. |
| Env gating | **None** | Both keys are dev-server-only; `nuxt build` ignores them. No `NODE_ENV` guard, no `VITE_*` flag. |

## Files in this spec

| File | Purpose |
|---|---|
| `README.md` | This index + Execution Directive. |
| `implementation.md` | The exact config diff for `packages/auth-layer/nuxt.config.ts`, the candidate dep list with rationale, the log-confirmation procedure, and verification steps. |

## Implementation Task List

- [x] **Phase 1 — Prebundle (#2).** Expanded `vite.optimizeDeps.include` in
  `packages/auth-layer/nuxt.config.ts`; final log-confirmed list
  `@nuxtjs/color-mode, @urql/vue, @vueuse/core, @nuxt/ui, reka-ui` (candidate transitive deps
  pruned). tenant-app pins `mapbox-gl` in its own block.
- [x] **Phase 2 — Warmup (#3).** Added `vite.server.warmup.clientFiles: ['./app/pages/**/*.vue']`
  to the auth-layer `vite` block; merges with each app's `vite.server.hmr`. Logs show
  `Vite server/client warmed up` on all six apps.
- [x] **Phase 3 — Confirm the dep list against logs.** Full rebuild + per-app log read:
  pruned 4 `Unresolvable` entries, added tenant-app `mapbox-gl` (the one runtime-discovered dep).
- [x] **Phase 4 — Verify.** tenant-app auto-restarted and came back clean (no `Unresolvable`,
  no runtime discovery, no reload); `pnpm build` green (14/14). Other five apps carry a harmless
  stale warning until their next restart (own config unchanged).
- [x] **Phase 5 (doc).** Added a "Dev startup performance" subsection to
  `monorepo-bootstrap-pattern.md`.

## Remaining Open Questions

- [x] **Exact `optimizeDeps.include` list.** Resolved 2026-07-20 from dev-server logs.
  Shared (auth-layer): `@nuxtjs/color-mode, @urql/vue, @vueuse/core, @nuxt/ui, reka-ui`
  (four candidate transitive deps pruned as `Unresolvable` — already covered by their parents'
  prebundle). App-specific: tenant-app pins `mapbox-gl` (CJS, airport map). Warmup confirmed
  active on all six apps.

## Considered & rejected

- **Per-app `vite` blocks.** Rejected — duplicates the list six times and drifts. `auth-layer`
  is the single inherited root.
- **Switching apps to a production build** (diagnosis #1). Not rejected on merit — it is the
  real fix for "slow first load," but it sacrifices HMR and is out of scope for this spec
  (which is explicitly the two HMR-preserving wins). Left as a QA-session option.
- **Post-startup `curl` warmup script** (diagnosis #4). Out of scope; complementary, can be a
  follow-up.
- **Warming layer-provided pages via `node_modules` globs.** Rejected as fragile; deferred to
  profiling-driven, explicit additions.
- **Gating behind `NODE_ENV`/a Vite flag.** Unnecessary — both keys are dev-only by
  construction.
