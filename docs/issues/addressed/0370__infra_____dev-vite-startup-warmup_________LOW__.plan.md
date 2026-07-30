# 0370 — Dev startup performance: Vite prebundle + route warmup

> **Execution Directive:** execute this plan via
> `/fnb-stack-implementor .claude/issues/identified/0370__infra_____dev-vite-startup-warmup_________LOW__.plan.md`.
> On completion, ask the user (yes/no) before moving this file to `.claude/issues/addressed/` (R23).

**Spec:** `.claude/specs/dev-startup-performance/README.md` (+ `implementation.md`)
**Severity:** LOW (dev-experience only, non-blocking) · **Category:** infra

## Summary

The site is slow to load after startup because every app runs `nuxt dev` (`NODE_ENV=development`)
and Vite compiles lazily, per-route, per-app. Two HMR-preserving dev-server settings fix it,
both in **one file** — `packages/auth-layer/nuxt.config.ts`, the universal root of the extends
chain (all six apps inherit its `vite` config via Nuxt's defu merge):

1. Expand `vite.optimizeDeps.include` so heavy shared **browser** deps are prebundled at boot
   (kills the mid-request "new dependencies optimized … reloading" full-page reload freeze).
2. Add `vite.server.warmup.clientFiles` so each app's page graph transforms at startup, not on
   first click.

Both keys are **dev-server-only** — `nuxt build` ignores them, so `pnpm build` (the gate) is
unaffected. No DB / GraphQL / composable / UI changes. No new dependencies.

## Verified anchors

- `packages/auth-layer/nuxt.config.ts` L35–39 — the single existing `vite` block, currently
  `optimizeDeps.include: ['@nuxtjs/color-mode', '@urql/vue', '@vueuse/core']`. No `server.warmup`.
- Extends chain: `auth-app→auth-layer`; `home/msg/storage/game/tenant → …→ tenant-layer → auth-layer`.
  Editing `auth-layer` reaches all six Vite processes (defu concatenates `include` arrays, merges
  `server.warmup` alongside each app's existing `vite.server.hmr`).
- Page counts (warmup glob targets): `tenant-app` 36, `auth-app` 3, `home-app` 1 (`app/pages/**/*.vue`).
- Server-only deps present in layers (`pg`, `@aws-sdk/client-s3`, `nitropack`, `h3`) — **excluded**
  from `optimizeDeps` (browser graph only).

---

## Phase 1 — Prebundle heavy browser deps (spec §1)

1. In `packages/auth-layer/nuxt.config.ts`, replace the `vite` block with the expanded version
   from `implementation.md` §1 — **keep the existing three entries**, add candidates:
   `@urql/core`, `graphql`, `@nuxt/ui`, `reka-ui`, `tailwind-variants`, `@internationalized/date`.
   Include the explanatory comment (dev-only; server deps excluded).

## Phase 2 — Route warmup (spec §2)

2. In the same `vite` block add `server.warmup.clientFiles: ['./app/pages/**/*.vue']`
   (resolves per-app against each app's `rootDir`; layer-provided pages deferred — spec Locked
   decisions). Confirm the merged `vite.server` shape coexists with each app's `hmr` key.
3. **Verify build:** `pnpm build` passes; spot-check `.output` contains no `optimizeDeps`/`warmup`
   (dev-only keys, absent from the production build).

## Phase 3 — Confirm the dep list against logs (resolves the spec's one Open Question)

4. **Ask the user to restart** the env (`docker compose down && docker compose up`) — never
   rebuild/restart it yourself (memory `feedback_rebuild_ask_user`).
5. Read-only: tail each app's logs while first-navigating its routes and grep for
   `new dependencies optimized` / `reloading` / `Failed to resolve dependency` (spec §3):
   - a boot-time `Failed to resolve dependency: X` → wrong candidate name → remove `X`.
   - an on-navigation `optimized: …` + `reloading` → add the named dep(s), re-batch, ask for
     another restart.
   Iterate until first navigation to each app's main routes produces no `reloading` line.

## Phase 4 — Verify (read-only, spec §4)

6. Confirm: no mid-request `reloading` after boot; first navigation to a not-yet-visited route
   is visibly faster; `pnpm build` still green.

## Phase 5 — Optional doc pointer

7. Add a short "Dev startup performance" subsection to
   `.claude/specs/monorepo-bootstrap-pattern.md` pointing at this convention. **Not** an R21
   architecture change (no new rule/pattern) — documentation pointer only; skip if out of scope
   for the session.

---

## Phase 3 outcome (log-confirmed 2026-07-20)

Full rebuild + per-app log read resolved the dep list authoritatively:

- **Warmup confirmed** — every app logs `Vite server/client warmed up`. It even surfaced
  tenant-app's `mapbox-gl` proactively during warm-up rather than on a user click.
- **Pruned** (all six apps warned `Unresolvable optimizeDeps.include`): `@urql/core`, `graphql`,
  `tailwind-variants`, `@internationalized/date` — transitive-only, already inside the
  `@urql/vue` / `@nuxt/ui` prebundles. Shared list is now
  `@nuxtjs/color-mode, @urql/vue, @vueuse/core, @nuxt/ui, reka-ui`.
- **Added** — `mapbox-gl` (CJS, `AirportMapView.vue`) to **tenant-app's own** `optimizeDeps.include`
  (tenant-app-only dep — sharing it would make the other five apps warn). No other app discovered
  any new dep.
- `pnpm build` green (14/14) after the correction.

## Notes / constraints

- **No git** (global rule): do not commit; stop and report at completion.
- **Never rebuild the env yourself** — Phases 3–4 need a user-run restart, then read-only checks.
- The final `optimizeDeps.include` list is authoritative from **logs**, not this plan — Phase 3
  prunes/adds against real output.
