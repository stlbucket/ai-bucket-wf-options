# Execution log — 0020_recur__dependency-audit — 2026-07-23

Third housekeeping run, part of a full `000_1` suite pass. `pnpm dep-audit` (R24) is the
enforcement gate. New surface since 2026-07-22: the poll feature (composables/mappers in
existing packages — no new workspace package).

## Checklist results

1. **Floating specifiers** — none. Scanned every workspace `package.json` (`dependencies` +
   `devDependencies`): no `latest`, `*`, or `>=` ranges in real deps.
2. **Stale/unused workspace deps** — none. dep-audit reports no unused `@function-bucket/*`
   declarations; `graphql-client-api` still has no dep on `db-access` (layering rule holds).
3. **Direct-dependency rules honored** — dep-audit reports **no missing declarations** (the
   poll code introduced no undeclared imports, unlike the 07-22 auth-app case). All seven Nuxt
   apps declare their own `@iconify-json/*` collections.
4. **Lockfile consistency** — `pnpm install` resolves cleanly (16.2s), no version drift. The
   pre-existing vite-8-vs-plugin peer warnings remain informational (upstream ranges), as noted
   in prior runs.

## Kept deliberately (dep-audit "unused" informational — both known false positives)

- `apps/graphql-api-app: pg` — needed at runtime by `postgraphile/adaptors/pg`.
- `packages/auth-layer: @sentry/nuxt` — registered as a Nuxt **module** in `nuxt.config.ts`,
  invisible to the import scan.

## Fixed inline this run

- **Duplicated auto-import `PollStatus`** — `pnpm install` surfaced a Nuxt warning: both
  `apps/tenant-app/app/composables/usePollList.ts` and `usePollDetail.ts` re-exported
  `PollStatus` from `@function-bucket/fnb-types`, so Nuxt's auto-import dropped one
  (`Duplicated imports "PollStatus" … has been ignored`). Harmless (identical type) but noise
  that could mask a genuine collision. Removed the duplicate from `usePollList.ts` — the
  detail re-export carries the full poll type family, and the only page consumer
  (`tools/poll/index.vue`) imports `PollStatus` directly from `fnb-types` anyway. Warning
  confirmed gone on reinstall.

## Spawned identified/ items

None — the one finding was fixable inline.

## Gate

`pnpm dep-audit` — **clean** (no missing declarations, no catalog/specifier violations).
`pnpm build` — **green** (13/13) after the `usePollList.ts` edit.
