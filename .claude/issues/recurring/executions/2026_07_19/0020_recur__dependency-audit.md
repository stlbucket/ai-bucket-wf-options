# Execution log — 0020_recur__dependency-audit — 2026-07-19

## Checklist results

1. **Floating specifiers** — none. No `latest`/`*` anywhere; `pnpm dep-audit` reports no
   catalog/specifier violations.
2. **Stale/unused workspace deps** — none. (Initial grep hits were false positives — packages
   matching their own `name:` field.) The client data layer has no runtime dep on `db-access`.
3. **Direct-dependency rules** — two gaps found and fixed inline:
   - `apps/home-app` renders `i-lucide-*` (own pages + inherited tenant-layer nav) but declared
     no icon collection → added `"@iconify-json/lucide": "catalog:"`.
   - `apps/msg-app` (inherits msg-layer/tenant-layer icon components) same gap → added
     `"@iconify-json/lucide": "catalog:"`.
   `@iconify-json/simple-icons` was checked and is NOT needed there (no `i-simple-icons-*`
   usage in those trees). `@nuxt/ui` is declared directly by every app/layer that needs it.
4. **Lockfile consistency** — `pnpm install` resolves cleanly (19s, no drift). Pre-existing
   informational peer warnings about vite 8 vs vite-plugin-inspect peers — upstream ranges,
   not actionable here.

## Kept deliberately

- `apps/graphql-api-app` declares `pg` with no direct source import — flagged informational by
  dep-audit. Kept: `graphile.config.ts` uses `postgraphile/adaptors/pg`, which requires `pg`
  resolvable at runtime in the app context (nitro externalizes it in the Docker image).

## Spawned identified/ items

None.

## Gate

`pnpm build` — **green** (12/12). `pnpm dep-audit` — clean.
