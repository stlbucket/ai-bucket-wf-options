# Assets Page — Data (`/storage/assets`)


> **URN stacking v2 (2026-07-10):** `storage.asset.context` (+ the `asset_context` enum) and
> `owning_entity_id` are **removed** — `subject_urn` is the only attach mechanism. Upload takes an
> optional `subjectUrn` form field (no `context`/`owningEntityId`); per-subject reads are
> `assetsBySubject` / `publicAssetsForSubjectList(_subjectUrn)` via `useSubjectAssets(subjectUrn)`;
> the quarantine key is `quarantine/{tenantId}/{subjectSeg}/{assetId}.{ext}`. Authoritative
> contract: `.claude/specs/urn-registry/stacking-v2.data.md`. `context`/`owning_entity_id`
> mentions below are historical.

## Status
**Implemented & verified 2026-07-06** (Phases 8–9). `useSiteAssets()` (GraphQL, RLS-scoped) +
`useAssetUpload()` (REST 202/PENDING) both live; storage-app + quarantine-first architecture.

**v2 (2026-07-06 spec / 2026-07-07 implemented) — image processing:** `upload(...)` gained `tags` +
`aiTagsRequested` params (marked **(v2 draft)** below); the `AllAssets` query behind `useSiteAssets`
filters to originals only (`graphql.data.md`). **Implemented 2026-07-07** (`pnpm build` green).
Driven by `.claude/issues/addressed/0350__storage___asset-image-thumbnails__________LOW__.plan.md`.

Data for `packages/storage-layer/app/pages/assets/index.vue`. **Reads are GraphQL**; **upload is
REST (202 Accepted)**. See `graphql.data.md` for the GraphQL layer and `endpoint.data.md` for the
upload endpoint.

---

## Read — `useSiteAssets()` (GraphQL)

- **Source:** `packages/graphql-client-api/src/composables/useSiteAssets.ts`, wrapping the generated
  `useAllAssetsQuery` (from the `AllAssets` operation — see `graphql.data.md`) and mapping nodes
  through `toAsset` (`src/mappers/asset.ts`).
- **storage-layer re-export:** `packages/storage-layer/app/composables/useSiteAssets.ts`:
  ```ts
  export { useSiteAssets } from '@function-bucket/fnb-graphql-client-api'
  export type { Asset } from '@function-bucket/fnb-types'
  ```
- **Return shape** (mirror `useSupportTickets`): `{ assets: ComputedRef<Asset[]>, fetching, error, refresh }`.
  - `assets` normalizes `data.value?.assets ?? []` (list-form query, aliased), filters nulls, maps
    through `toAsset`.
  - `fetching` replaces `pending`; `refresh()` wraps `executeQuery({ requestPolicy: 'network-only' })`
    — call it after an upload and to poll `PENDING` rows.
- **RLS-scoped:** `manage_all_super_admin` returns every tenant's rows for a super-admin; everyone
  else gets their own tenant's rows via `manage_all_for_tenant`. Same composable serves both.
- **Type:** `Asset` comes from **`@function-bucket/fnb-types`** (R3, current form) — hand-written
  flat shape; `downloadUrl: string | null` (null while not `CLEAN`); the generated `AssetFragment`
  stays internal to `graphql-client-api`, bridged by the mapper.

## Write — `useAssetUpload()` (REST, 202)

- **Source:** `packages/storage-layer/app/composables/useAssetUpload.ts` (layer-local; upload is
  REST, not part of the GraphQL client). Consumed by the `AssetUploader` component.
- **Pattern:** A — imperative `$fetch`.
```ts
import type { AssetContext, AssetMeta } from '@function-bucket/fnb-types'   // shared vocabulary (see _shared.data.md)

export function useAssetUpload() {
  const uploading = ref(false)
  const error = ref<string | null>(null)
  const url = `${useRuntimeConfig().public.uploadUrl}`          // see runtimeConfig note

  async function upload(file: File, context: AssetContext, owningEntityId: string | null,
                        isPublic = false, tags: string[] = [], aiTagsRequested = false) {  // (v2 draft) 2 new params
    uploading.value = true; error.value = null
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('context', context)                            // fnb-types value (UPPERCASE)
      if (owningEntityId) form.append('owningEntityId', owningEntityId)
      if (isPublic) form.append('isPublic', 'true')
      if (tags.length) form.append('tags', tags.join(','))       // (v2 draft) pre-normalized by AssetUploader
      if (aiTagsRequested) form.append('aiTagsRequested', 'true') // (v2 draft) images only (endpoint 400s otherwise)
      // 202 Accepted — returns the PENDING AssetMeta; the asset-scan workflow finishes later
      return await $fetch<AssetMeta>(url, { method: 'POST', body: form })   // browser sets multipart boundary
    } catch (e: any) {
      error.value = messageForStatus(e?.statusCode, e?.data); throw e
    } finally { uploading.value = false }
  }
  return { upload, uploading, error }
}
```
- Do **not** set `Content-Type` manually. Same-origin (nginx), so the `session` cookie is sent
  automatically (Q5); add `credentials: 'include'` only if verification shows it's needed.
- The returned `AssetMeta` always has `scanStatus: 'PENDING'` — the UI shows "scanning…" and relies
  on list `refresh()` to observe the verdict (see `components.ui.md`).

## Endpoint URL / runtimeConfig

Add `public.uploadUrl` to storage-layer's `nuxt.config.ts` (overridable per app), default
`'http://localhost:4000/storage/api/upload'` — the existing `public.*` keys use full
`localhost:4000` URLs (e.g. `graphqlApiUrl: 'http://localhost:4000/graphql-api/api/graphql'`), so
mirror that style rather than a root-absolute path. Same-origin through nginx either way, so the
`session` cookie flows (Q5).

## Status → toast message (`messageForStatus`)

| statusCode | message |
|-----------|---------|
| 400 | "Invalid upload (missing file or context)" — (v2 draft) also covers rejected tags / AI-tags-on-non-image; consider "Invalid upload (check fields and tags)" |
| 413 | "File too large (max 5 MB)" |
| 415 | "File type not allowed" |
| 401 | "Please sign in again" |
| other | "Upload failed" |

(The old 422 "malware detected" / 502 "scanner unavailable" messages are gone — scanning is async
now. An infected verdict surfaces later as the row being soft-deleted / an `Infected` badge, not as
an upload error.)

## Types
- `Asset` (reads) — `@function-bucket/fnb-types` (mapped from the codegen `AssetFragment` by `toAsset`), incl. nullable `downloadUrl`.
- `AssetMeta` (upload 202 response) — `@function-bucket/fnb-types` (shared by the endpoint and the UI; see `_shared.data.md`).

## Open Questions (page data)
- [x] `public.uploadUrl` runtimeConfig key — resolved: use it, full-URL style like `graphqlApiUrl`.
- [x] `Asset` fragment covers what `AssetList` needs — confirmed after codegen; `tenantName` comes
  from the **`tenant`** relation (not `storageTenant`) selected alongside the fragment in `AllAssets`.
- [ ] Whether the page auto-polls while any row is `PENDING` (e.g. `refresh()` every few seconds
  until settled) or relies on manual refresh — v1 default: manual/one-shot after upload.
