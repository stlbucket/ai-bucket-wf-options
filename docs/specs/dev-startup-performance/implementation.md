# Implementation — Dev Startup Performance

## Status

Draft. All edits target a **single file**: `packages/auth-layer/nuxt.config.ts`. No new
dependencies, no new files, no DB/GraphQL/UI changes. Dev-server-only — `nuxt build` ignores
both keys, so `pnpm build` (the gate) is unaffected.

## Context — why one file covers all six apps

`auth-layer` is the root of the extends chain:

```
auth-app   → auth-layer
home-app   → tenant-layer → auth-layer
tenant-app → storage-layer → tenant-layer → auth-layer   (+ direct tenant-layer)
msg-app    → msg-layer     → tenant-layer → auth-layer
storage-app→ storage-layer → tenant-layer → auth-layer
game-app   → game-layer    → tenant-layer → auth-layer
```

Nuxt merges the `vite` config from every extended layer with **defu** (later/consumer wins for
scalars; **arrays concatenate**). So `optimizeDeps.include` set in `auth-layer` concatenates
with any app-level list, and `server.warmup` merges alongside each app's existing
`vite.server.hmr` object. Editing `auth-layer` once reaches all six Vite processes.

Current `auth-layer` block (`packages/auth-layer/nuxt.config.ts`):

```ts
  vite: {
    optimizeDeps: {
      include: ['@nuxtjs/color-mode', '@urql/vue', '@vueuse/core'],
    },
  },
```

---

## §1 — Phase 1: expand `optimizeDeps.include` (#2)

Replace the `vite` block with the expanded version below. **Keep the existing three entries.**

```ts
  vite: {
    optimizeDeps: {
      // Prebundle heavy shared BROWSER deps at boot so Vite does not discover them
      // mid-request and force a full-page reload ("new dependencies optimized: …,
      // reloading"). Dev-only — `nuxt build` ignores optimizeDeps. Server-only deps
      // (pg, @aws-sdk, nitropack, h3) are NOT listed — this is the browser graph.
      include: [
        // existing
        '@nuxtjs/color-mode',
        '@urql/vue',
        '@vueuse/core',
        // GraphQL data layer
        '@urql/core',
        'graphql',
        // Nuxt UI + its headless base (the most frequent re-optimize triggers)
        '@nuxt/ui',
        'reka-ui',
        'tailwind-variants',
        // date/i18n deps pulled in transitively by Nuxt UI date components
        '@internationalized/date',
      ],
    },
    server: {
      warmup: {
        clientFiles: ['./app/pages/**/*.vue'],
      },
    },
  },
```

### Candidate dep rationale

| Dep | Why it belongs | Source |
|---|---|---|
| `@urql/core` | urql's core; deep-imported by `@urql/vue`. | `graphql-client-api` transport |
| `graphql` | Large CJS-interop module; imported by every urql doc/mapper. | urql peer |
| `@nuxt/ui` | The single heaviest browser dep; declared in every layer's `package.json`. | layer chain |
| `reka-ui` | Nuxt UI v4's headless primitive base — classic "new deps optimized, reloading" culprit on first component render. | `@nuxt/ui` transitive |
| `tailwind-variants` | Nuxt UI's variant engine; deep ESM. | `@nuxt/ui` transitive |
| `@internationalized/date` | Pulled by Nuxt UI date/calendar components; heavy. | `@nuxt/ui` transitive |

> These are **candidates**, not gospel. `reka-ui` / `tailwind-variants` / `@internationalized/date`
> are transitive and their exact package names must be confirmed against the log output in §3.
> If a name is wrong Vite logs `Failed to resolve dependency: <name>` at startup — prune it.

---

## §2 — Phase 2: route warmup (#3)

Already included in the block above (`vite.server.warmup.clientFiles`). Notes:

- **Path resolution:** `clientFiles` globs resolve against the **consuming app's Vite root**
  (`rootDir`), not `auth-layer`'s. Nuxt 4 keeps pages at `app/pages/`, so
  `./app/pages/**/*.vue` matches each app's own pages. Confirmed page counts:
  `tenant-app` 36, `auth-app` 3, `home-app` 1, plus layer pages (deferred).
- **`clientFiles` vs `ssrFiles`:** `tenant-app` routes are predominantly `ssr: false`
  (see its `routeRules`), so the **client** transform is what stalls — `clientFiles` is
  correct. If a mostly-SSR app shows cold SSR loads, add `ssrFiles` with the same glob.
- **Merge safety:** apps that already set `vite.server.hmr` (all of them) keep it — defu merges
  `warmup` into the same `server` object. Verify the merged shape after the edit by checking one
  app boots without a Vite config warning.

---

## §3 — Phase 3: confirm the list against logs (resolves the Open Question)

The authoritative `include` list is whatever Vite prints. **Do not rebuild/restart the env
yourself — ask the user** (memory `feedback_rebuild_ask_user`), then verify read-only.

After the user restarts (`docker compose down && docker compose up`):

```bash
# Watch a slow app while first-navigating each of its routes in the browser.
docker compose logs -f tenant-app | grep -iE 'optimized|reloading|Failed to resolve'
```

- Every `✨ new dependencies optimized: <names>` line that appears **on navigation** (not at
  boot) names a dep that should be **added** to `include`.
- A `reloading` line right after is the freeze the user feels — its trigger is in the preceding
  `optimized:` list.
- `Failed to resolve dependency: <name>` at boot = a wrong candidate name — **remove** it.
- Repeat per app (`auth-app`, `home-app`, `msg-app`, `storage-app`, `game-app`) — different
  apps surface different components (maps in `loc`, upload in `storage`, game boards in `game`).

Iterate until first navigation to each app's main routes produces **no** `optimized/reloading`
line. (Requires a user restart each time `include` changes — batch the additions.)

---

## §4 — Phase 4: verify (read-only)

1. **No mid-request reload:** with logs tailing, click into a representative route per app; no
   `reloading` line fires after the initial boot optimization.
2. **Warmup ran:** at startup the app transforms pages proactively (server is busier for a few
   seconds after "Vite server warmed up" / listening, then routes open fast).
3. **Latency:** first navigation to a not-yet-visited route is visibly faster than before
   (no multi-second stall).
4. **Build unaffected:** `pnpm build` still passes — both keys are dev-only and absent from the
   production build (spot-check: no `optimizeDeps`/`warmup` in `.output`).

## Failure signatures

| Symptom | Cause | Fix |
|---|---|---|
| `Failed to resolve dependency: X` at boot | `X` not an installed browser dep (wrong name / server-only) | Remove `X` from `include`. |
| Warmup glob matches nothing / no warm-up effect | Glob resolved against the wrong root, or Nuxt `srcDir` differs | Confirm pages are at `app/pages/`; the glob is app-root-relative. |
| `reloading` still fires on a route | A dep still not prebundled | Read the `optimized:` line, add that dep, restart (ask user). |
| One app throws a Vite `server` config warning | `warmup`/`hmr` merge shape | Inspect the defu-merged `vite.server` for that app; ensure both keys coexist. |
