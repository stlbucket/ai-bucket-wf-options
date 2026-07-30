# Asset Detail Page — Data (`/storage/assets/[id]`)

## Status
**Implemented — 2026-07-07.** The asset **detail** page, built on three pieces (all specced here +
in `_shared.data.md` / `graphql.data.md` / `endpoint.data.md`):
1. a `wf_id` column on `storage.asset` (deep-link to the processing workflow),
2. an `AssetDetail` GraphQL query (asset-by-id + uploader/tenant relations + derived children),
3. a **REST delete** carve-out (`DELETE /storage/api/assets/[id]`) — soft-delete + object purge,
   mirroring the upload endpoint (GraphQL never exposes `storage_api`).

Decisions locked with the user 2026-07-07: **soft-delete + purge object (cascade to children)**,
**own-tenant users + super-admin may delete**, **store `wf_id` and deep-link to the workflow
instance**.

Data for `packages/storage-layer/app/pages/assets/[id].vue`. **Reads are GraphQL**; **delete is
REST** (same posture as upload — multipart/side-effecting object writes stay off GraphQL, and
`storage_api` is deliberately unexposed, see `graphql.data.md` §1). UI in `asset-detail.ui.md`;
shared types + DB in `_shared.data.md`.

---

## Read — `useAssetDetail(id)` (GraphQL)

- **Source:** `packages/graphql-client-api/src/composables/useAssetDetail.ts`, wrapping the
  generated `useAssetDetailQuery` (from the `AssetDetail` operation — see `graphql.data.md` §4) and
  mapping nodes through `toAsset` (`src/mappers/asset.ts`).
- **storage-layer re-export:** `packages/storage-layer/app/composables/useAssetDetail.ts`:
  ```ts
  export { useAssetDetail } from '@function-bucket/fnb-graphql-client-api'
  export type { Asset } from '@function-bucket/fnb-types'
  ```
- **Signature / return** (mirror `useWfDetail` — takes a `MaybeRef<string>` id):
  ```ts
  export function useAssetDetail(id: MaybeRef<string>) {
    const { data, fetching, error, executeQuery } = useAssetDetailQuery({
      variables: computed(() => ({ id: unref(id) })),
    })
    const asset = computed<AssetDetailView | null>(() => {
      const n = data.value?.asset
      if (!n) return null
      return {
        ...toAsset(n),
        tenantName: n.tenant?.name ?? null,
        uploaderName: n.resident?.displayName ?? null,   // NEW relation — see graphql.data.md §4
      }
    })
    const children = computed<Asset[]>(() =>
      (data.value?.children ?? []).filter(Boolean).map(toAsset))
    const refresh = () => executeQuery({ requestPolicy: 'network-only' })
    return { asset, children, fetching, error, refresh }
  }
  ```
- **`AssetDetailView`** (composable view type, R4) extends `Asset` with `uploaderName: string | null`
  (the `tenantName` field already exists on `Asset`). Lives in
  `packages/graphql-client-api/src/composables/useAssetDetail.ts`.
- **`asset`** resolves to `null` when the id is unknown **or** RLS hides the row (a user asking for
  another tenant's asset). The page renders a not-found state either way (`asset-detail.ui.md`).
- **`children`** are the derived assets (v1: the 256px webp thumbnail) fetched by
  `parentAssetId = $id` — this is the **one** place children are queried; every list view filters
  `parentAssetId: null` to hide them (`graphql.data.md`). RLS-scoped like the parent.
- **RLS-scoped:** the detail query runs as the caller — own-tenant users see their tenant's asset;
  super-admins see any tenant's (`manage_all_super_admin`). Same query serves both audiences, like
  the list page.
- **`fetching`** replaces `pending`; `refresh()` wraps `executeQuery({ requestPolicy: 'network-only' })`
  — call it to poll a still-`PENDING` asset and after a (failed) delete.

## Delete — `useAssetDelete()` (REST, soft-delete + purge)

- **Source:** `packages/storage-layer/app/composables/useAssetDelete.ts` (layer-local; delete is a
  side-effecting object-write carve-out, not part of the GraphQL client — same reasoning as
  `useAssetUpload`).
- **Pattern:** A — imperative `$fetch`.
  ```ts
  export function useAssetDelete() {
    const deleting = ref(false)
    const error = ref<string | null>(null)
    const base = `${useRuntimeConfig().public.uploadUrl}`.replace(/\/upload$/, '')  // → .../storage/api

    async function remove(id: string) {
      deleting.value = true; error.value = null
      try {
        // 200 { deleted: n } — the asset + its derived children, soft-deleted; objects purged
        return await $fetch<{ deleted: number }>(`${base}/assets/${id}`, { method: 'DELETE' })
      } catch (e: any) {
        error.value = messageForDeleteStatus(e?.statusCode); throw e
      } finally { deleting.value = false }
    }
    return { remove, deleting, error }
  }
  ```
- Same-origin through nginx, so the `session` cookie flows automatically (Q5); no CSRF token.
- On success the page toasts and **navigates back to `/storage/assets`** (the row is gone from the
  active list — `downloadUrl` is now null and the list filters `assetStatus`/shows it deleted, see
  Open Questions). The list's own `refresh()` on next mount reflects the change.

### Endpoint URL / runtimeConfig
**Resolved (2026-07-07): derive from `public.uploadUrl`** — reuse the existing key
(`.../storage/api/upload`) and strip the trailing `/upload` to get `.../storage/api`, then
`${base}/assets/${id}`. No new `public.assetsApiBase` key was added.

### Delete status → toast message (`messageForDeleteStatus`)
| statusCode | message |
|-----------|---------|
| 403 | "You don't have permission to delete this asset" |
| 404 | "Asset not found (already deleted?)" |
| 401 | "Please sign in again" |
| other | "Delete failed" |

---

## Delete endpoint (REST carve-out) — `DELETE /storage/api/assets/[id]`

Full contract in `endpoint.data.md` (added alongside the upload endpoint). Summary:

- **Handler:** `packages/storage-layer/server/api/assets/[id].delete.ts`.
- **Auth:** `event.context.claims` (UI hint: `p:app-admin` OR `p:app-user`); the DB re-enforces.
- **DB:** `withClaims(claims, fn)` → `select * from storage_api.delete_asset($1::uuid)`.
  - `storage_api.delete_asset` is **SECURITY INVOKER** (runs as the caller): RLS scopes exactly
    which rows the update touches (own-tenant via `manage_all_for_tenant`, or any via
    `manage_all_super_admin`). A cross-tenant caller updates **0 rows** — no extra gate needed
    (this is precisely the "own-tenant users + super-admin" decision, enforced by the existing
    policies). See `_shared.data.md`.
  - It soft-deletes the asset **and its derived children** in one statement
    (`where (id = $1 or parent_asset_id = $1) and asset_status = 'active'`), setting
    `asset_status = 'deleted'`, and **returns the affected rows** so the endpoint knows which
    `(bucket, storage_key)` objects to purge.
- **Object purge:** for each returned row, `DeleteObject` from MinIO (best-effort; log failures —
  a stranded object is later reaped by the `quarantine/` lifecycle rule only if still under
  quarantine, so a promoted-then-orphaned object is an accepted small risk, recorded below).
- **Response:** `200 { deleted: <count> }` (0 ⇒ nothing matched under RLS → the endpoint returns
  **404** so the UI can distinguish "not yours / not found" from a real delete).
- **Idempotent:** deleting an already-`deleted` asset matches 0 active rows → 404; safe to retry.

---

## GraphQL additions (see `graphql.data.md` for full detail)

- **`wfId`** added to `fragment Asset` (new exposed column — deep-links the detail page to the
  workflow instance). Flows through `toAsset` into fnb-types `Asset.wfId: string | null`.
- **`AssetDetail($id: UUID!)`** query — `asset(id: $id)` (by-PK accessor) selecting `...Asset` plus
  the `tenant { name }` and **`resident { displayName }`** relations, and a
  `children: assetsList(condition: { parentAssetId: $id }, orderBy: CREATED_AT_DESC) { ...Asset }`
  root. One round-trip for the whole page.
- **`downloadUrl` gate tightened** — the presign plugin now also returns `null` when
  `asset_status != 'active'` (a soft-deleted asset must not mint a URL; its object is purged
  anyway). `graphql.data.md` §3.

---

## Types
- `Asset` (+ new `wfId`) — `@function-bucket/fnb-types` (mapped from `AssetFragment` by `toAsset`).
- `AssetDetailView` (adds `uploaderName`) — composable view type in
  `packages/graphql-client-api/src/composables/useAssetDetail.ts` (R4).

## Resolved (was Open Questions — page data)
- [x] runtimeConfig → **derive from `public.uploadUrl`** (no new `public.assetsApiBase` key).
- [x] Row-by-PK accessor → **`asset(id: $id)`** (verified via live introspection — not `assetById`).
- [x] `resident` relation → **`resident { displayName }`** (verified — a `StorageResident` node;
  not `storageResident` / `residentByResidentId`). `tenant { name }` likewise confirmed.
- [x] Soft-deleted rows in the site list → **left `AllAssets` unfiltered** (operator visibility, per
  `asset-entity-composable.plan.md` W3). Consistency is maintained by the §4 presign gate: a deleted
  row shows a `Deleted` badge and a null `downloadUrl` (no working download). No `assetStatus` filter
  was added — coordinate with W3 before changing this.

## Open Questions (page data) — deferred, not blocking
- [ ] Whether the detail page auto-polls while the asset is `PENDING` (mirror the list's deferred
  auto-poll question) — v1 default: manual/one-shot `refresh()`.
