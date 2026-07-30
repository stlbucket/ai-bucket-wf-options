# Plan: `useEntityAssets` composable + entity-page embedding (asset-storage v2 — final-eval M2, W3)

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/asset-entity-composable.plan.md`
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify
> read-only. Codegen: `pnpm -F @function-bucket/fnb-graphql-client-api generate` (PostGraphile must
> be running). Remember the barrel — a missing `src/index.ts` export is a runtime ESM crash.

**Severity: LOW (v2 enhancement)** · Workstream: asset-storage · Identified: 2026-07-06 (final-eval M2 + W3 decision)

## Details

The spec marks `useEntityAssets(context, owningEntityId)` "(future)" — the composable that lets a
todo / support-ticket detail page list its attached assets. Most of the plumbing already exists:

- GraphQL op `AssetsByOwningEntity` + generated hook — already in
  `packages/graphql-client-api` (op documents + `src/generated/fnb-graphql-api.ts`).
- Mapper `toAsset` — exists.
- `AssetList.vue` / `AssetUploader.vue` — props-only components in `storage-layer`, built for reuse.

Missing pieces:

1. **The composable** `packages/graphql-client-api/src/composables/useEntityAssets.ts` — wrap the
   generated hook, call `toAsset`, return fnb-types shapes (`computed` data, `fetching`, `error`;
   re-query via `executeQuery({ requestPolicy: 'network-only' })`). Barrel-export it.
2. **The W3 decision, codified** (final-eval): infected uploads are soft-deleted
   (`asset_status='deleted'`) but neither query filters them. Adopt the eval's recommended
   option (a): `AssetsByOwningEntity` gets `condition: { assetStatus: ACTIVE }` (entity pages
   never show a user their soft-deleted rows) while the site-admin `AllAssets` deliberately shows
   everything (operator visibility of infected attempts is a feature). Update the `.graphql` doc,
   re-run codegen, and **update `_shared.data.md`'s badge-section wording** to record the split —
   today's behavior is accidental.
3. **Consumption path** (recorded open question in the asset-storage README): tenant-app does not
   extend storage-layer. Recommended: add `@function-bucket/fnb-storage-layer` to tenant-app's
   `extends` so `AssetList`/`AssetUploader` and the upload endpoint's runtimeConfig resolve.
   Wrinkles: pnpm no-hoist means tenant-app's `package.json` must declare the layer (and keep its
   direct `@nuxt/ui` dep); layer changes don't hot-reload (`docker compose restart tenant-app`,
   never a rebuild); confirm nginx/session posture is unchanged (uploads still POST to
   `/storage/api/upload` same-origin — the `uploadUrl` runtimeConfig already handles this).
4. **Thin re-exports** in the consuming app: `apps/tenant-app/app/composables/useEntityAssets.ts`.

## Scope guard

This plan delivers the composable + the W3 filter + spec codification. Actually embedding the
components into a real todo/ticket detail page is a per-feature task for whichever module does it
first (it will need an `.ui.md`/`.data.md` update for that page — R18).

## Verification

- Codegen + build green; barrel verified.
- In GraphiQL: `assetsByOwningEntityList(condition: { assetStatus: ACTIVE }, ...)` excludes a
  soft-deleted (EICAR) row; `allAssets` still includes it.
- From a page calling `useEntityAssets('TODO', <id>)`: only that entity's active assets return,
  RLS-scoped to the caller's tenant.
- `_shared.data.md` records the option-(a) split.
