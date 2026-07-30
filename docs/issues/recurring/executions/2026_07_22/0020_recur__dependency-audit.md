# Execution log — 0020_recur__dependency-audit — 2026-07-22

Second housekeeping run. `pnpm dep-audit` (R24) is the enforcement gate.

## Checklist results

1. **Floating specifiers** — none in real deps. The only `>=`/range hits are legitimate
   `peerDependencies` (`vue >=3.4.0`, `nuxt >=4.0.0`, `@urql/vue >=2.0.0`) and `engines`
   (`node >=20`, `pnpm >=9`), which are correctly ranged. No `latest`/`*` anywhere.
2. **Stale/unused workspace deps** — none. dep-audit reports no unused `@function-bucket/*`
   declarations; the client data layer still has no runtime dep on `db-access`.
3. **Direct-dependency rules honored** — **three R24 violations found and fixed inline**, all in
   `apps/auth-app` from the new onboard/change-password/notification code (pnpm does not hoist
   these transitively, so the app that imports them must declare them):
   - `vue` imported by `app/components/NotificationPreferences.vue` → added `"vue": "catalog:"`.
   - `@function-bucket/fnb-auth-ui` imported by `app/pages/setup.vue` → added `"workspace:*"`.
   - `h3` imported by 7 new server files (`forgot-password.post.ts`, `onboard/*.post.ts`,
     `profile/change-password.post.ts`, `setup/initialize.post.ts`, `server/utils/onboard-cookie.ts`)
     → added `"h3": "catalog:"` (matching graphql-api-app + every layer's convention).
   `apps/auth-app` already declares both `@iconify-json/*` collections — the new `i-lucide-*` icon
   usage in the notify UI is covered.
4. **Lockfile consistency** — `pnpm install` resolves cleanly (19.5s) after the additions. The
   vite-8-vs-plugin peer warnings are pre-existing/informational (upstream ranges predate vite 8),
   as noted in the 2026-07-19 run — not actionable here.

## Kept deliberately (dep-audit "unused" informational — both false positives)

- `apps/graphql-api-app: pg` — no direct source import, but `graphile.config.ts` uses
  `postgraphile/adaptors/pg` which needs `pg` resolvable at runtime (same as last run).
- `packages/auth-layer: @sentry/nuxt` — registered as a Nuxt **module**
  (`modules: ['@nuxt/ui','@nuxt/fonts','@sentry/nuxt/module']` in `nuxt.config.ts`), not a JS
  import, so dep-audit's import scan can't see it. Correctly a direct dependency. Keep.

## Spawned identified/ items

None — the three violations were fixable inline.

## Gate

`pnpm dep-audit` — **clean** (no missing declarations, no catalog/specifier violations).
`pnpm build` — **green** (13/13) after the `apps/auth-app/package.json` additions + reinstall.
