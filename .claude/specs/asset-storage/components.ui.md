# Asset Components — Reusable UI


> **URN stacking v2 (2026-07-10):** `storage.asset.context` (+ the `asset_context` enum) and
> `owning_entity_id` are **removed** — `subject_urn` is the only attach mechanism. Upload takes an
> optional `subjectUrn` form field (no `context`/`owningEntityId`); per-subject reads are
> `assetsBySubject` / `publicAssetsForSubjectList(_subjectUrn)` via `useSubjectAssets(subjectUrn)`;
> the quarantine key is `quarantine/{tenantId}/{subjectSeg}/{assetId}.{ext}`. Authoritative
> contract: `.claude/specs/urn-registry/stacking-v2.data.md`. `context`/`owning_entity_id`
> mentions below are historical.

## Status
**Implemented & verified 2026-07-06** (Phase 9). `AssetUploader.vue` + `AssetList.vue` live in
`packages/storage-layer/app/components/`, 202/PENDING-aware. Scan-status **colors** go through the
shared `statusColor('asset', …)` map (added to `packages/auth-layer/app/utils/status.ts`, UC1);
scan **labels** ("Malware scan pending…", "Scan error") and the **context** badge (needs `primary`, outside the
`StatusColor` union) are asset-local in `AssetList`. `PageHeader` is duplicated into storage-layer
(it lives in tenant-app, not a layer, so it isn't inherited).

**v2 (2026-07-06 spec / 2026-07-07 implemented) — image processing:** `AssetUploader` restructured
from upload-on-select into a **staged** flow (select → options → explicit Upload) with a tags input
and an AI-tags checkbox (`i-lucide-x` clear button verified present, UC11); `AssetList` gains a Tags
column (one neutral subtle `UBadge` per tag). **Implemented 2026-07-07** (`pnpm build` green).
Sections marked **(v2 draft)**. Driven by
`.claude/issues/addressed/0350__storage___asset-image-thumbnails__________LOW__.plan.md`.

**detail (2026-07-07 — implemented) — asset detail page:** `AssetList` gains a `linkDetail?: boolean`
prop (default `true`) and its `#originalName-cell` wraps the name in a base-relative
`<ULink :to="`/assets/${id}`">` to the detail page. Sections marked **(detail)**.

Two reusable components used by the `/storage/assets` page now, and by todo / support-ticket detail
pages later. Location: `packages/storage-layer/app/components/` (auto-imported by storage-app; when
tenant-app later needs them for entity pages, the recommended path is adding storage-layer to
tenant-app's `extends` — recorded open question). Shared types + badge colors in `_shared.data.md`.

The whole point of `context` + `owningEntityId` props is that the **same** components drop into an
entity page unchanged — the host just passes `context="todo"` / `context="support-ticket"` and the
entity's id.

---

## `AssetUploader.vue`

Uploads a single file for a given context/entity. **Owns its POST** — this is the documented
exception to R2 (like `Msg.vue` owns its socket), because upload is an imperative multipart action,
not prop-driven rendering.

### Props
```ts
import type { AssetContext, AssetMeta } from '@function-bucket/fnb-types'
{
  context: AssetContext              // 'NO_CONTEXT' | 'TODO' | 'SUPPORT_TICKET' (fnb-types vocabulary)
  owningEntityId: string | null      // required (uuid) unless context === 'NO_CONTEXT'
  allowPublic?: boolean              // show a "Make public" toggle (default true); any p:app-user may publish
  accept?: string                    // default: the whitelist extensions
  disabled?: boolean
}
```
### Emits
```ts
(e: 'uploaded', asset: AssetMeta): void   // after a successful POST
(e: 'error', err: unknown): void
```
### Behavior / composition — (v2 draft) staged flow supersedes upload-on-select

> v1 uploaded the instant a file was selected (a `watch` on the file ref) — no moment to set
> per-file options. v2 stages the file first; the `watch`-fires-upload is **removed**.

1. **Select** — `UFileUpload` picks the file but no longer triggers the POST. Restrict picker
   with `accept` (client convenience; endpoint re-validates 415).
2. **Stage** — once a file is selected, show (all `:disabled` while `uploading`):
   - the filename + a clear/`x` `UButton` (re-selectable),
   - the existing "Make public" `USwitch` (when `allowPublic`; `is_public` immutable after
     upload — create-time choice only),
   - **Tags** `UInput` — placeholder "Tags, comma-separated"; any file type. Client-side
     split/trim/dedupe before calling `upload` (courtesy — the endpoint's normalization is
     authoritative, `endpoint.data.md`),
   - **"Generate AI tags"** `UCheckbox` with help/description text
     **"Coming soon — your request will be noted on the asset."** (locked copy). `:disabled`
     unless `file.type` is in the image whitelist (`image/png|jpeg|webp|gif` — mirror the
     endpoint's `IMAGE_TYPES`); **reset to unchecked** whenever a non-image is selected,
   - an explicit **Upload** `UButton` (`:loading="uploading"`).
3. **Upload** — `upload(file, context, owningEntityId, isPublic, tags, aiTagsRequested)`
   (`useAssetUpload`, see `assets-page.data.md`). Endpoint responds **202 Accepted** with a
   `PENDING` `AssetMeta`: on success `useToast().add({ color:'success', title: 'Upload accepted
   — scanning…' })` + emit `uploaded`; on failure toast `error` with `messageForStatus` text +
   emit `error` (UC7). Reset the staged file **and all option fields** after success/failure so
   the same file can be re-selected. The host page's list `refresh()` reveals the verdict later.

- Layout: `flex flex-wrap items-center gap-3` (UC5). Colors via tokens only (UC6). Verify all
  `i-lucide-*` names (UC11) — the clear button (suggest `i-lucide-x`) needs the per-use check.
- Layer-edit note: storage-layer changes don't hot-reload — `docker compose restart storage-app`
  (ask the user; never rebuild).

---

## `AssetList.vue`

Presentational table of assets. **Props-only, no data fetching** (R2). Reused by the site-admin page
(all assets) and later by entity pages (that entity's assets).

### Props
```ts
import type { Asset } from '@function-bucket/fnb-types'   // shared vocabulary (R3, current form)
{
  assets: Asset[]        // incl. downloadUrl and tenantName; mapped from codegen by toAsset upstream
  showTenant?: boolean   // include a Tenant column (site-admin cross-tenant view only)
  showContext?: boolean  // include Context column (default true; entity pages may hide it)
  linkDetail?: boolean   // (detail) name → base-relative /assets/[id] detail link (default true)
}
```
### Table (UTable, Nuxt UI v4 — UC13)
`TableColumn<Asset>[]`:
```ts
[
  ...(showTenant  ? [{ accessorKey: 'tenantName', header: 'Tenant' }] : []),
  { accessorKey: 'originalName', header: 'Name' },
  ...(showContext ? [{ accessorKey: 'context', header: 'Context' }] : []),
  { accessorKey: 'contentType', header: 'Type' },
  { accessorKey: 'sizeBytes',   header: 'Size' },
  { accessorKey: 'tags',        header: 'Tags' },       // (v2 draft)
  { accessorKey: 'isPublic',    header: 'Visibility' },
  { accessorKey: 'scanStatus',  header: 'Scan' },
  { accessorKey: 'createdAt',   header: 'Uploaded' },
  { id: 'actions' },
]
```
Cell slots (read `row.original`, never `row` — UC13):
- **(detail)** `#originalName-cell` → a `<ULink :to="`/assets/${row.original.id}`">` wrapping the
  name, so a row navigates to the **asset detail page** (`asset-detail.ui.md`). The link is
  **base-relative** (`/assets/…`, NOT `/storage/assets/…`) — `NUXT_APP_BASE_URL=/storage` makes Nuxt
  auto-prepend the base; the full-prefix form double-counts it → client 404. The detail page lives
  in storage-layer, so this link works from the site page now and from entity pages later (once
  tenant-app extends storage-layer). Optional `linkDetail?: boolean` prop (default `true`) lets an
  embed opt out of the link if a host wants row selection instead.
- `#context-cell` → `<UBadge>` per the context color map (`_shared.data.md`).
- `#isPublic-cell` → `<UBadge :color="row.original.isPublic ? 'warning' : 'neutral'">` showing
  `Public` / `Private` (public gets an attention color since it's anonymously reachable).
- `#scanStatus-cell` → `<UBadge>` per the scan-status color map. `PENDING` ("Malware scan pending…") is the
  **normal initial state** now — every fresh upload shows it until the workflow verdict lands.
- **(v2 draft)** `#tags-cell` → one `<UBadge color="neutral" variant="subtle">` per tag
  (`flex flex-wrap gap-1`); empty array renders nothing. This is where user tags and the
  `ai-tags-coming-soon` placeholder become visible — v1's only user-facing proof the AI-tags
  request took. (Thumbnail children never appear here — the list queries filter
  `parentAssetId: null` upstream, `graphql.data.md`.)
- `#sizeBytes-cell` → human-readable size (e.g. `1.2 MB`).
- `#createdAt-cell` → localized date.
- `#actions-cell` → download button **only when `row.original.downloadUrl !== null`**:
  `<UButton icon="i-lucide-download" :to="row.original.downloadUrl" target="_blank" />`
  (unsigned direct link for public, presigned for private; private saves under the original
  filename via `ResponseContentDisposition`). While `PENDING`/`INFECTED`/`ERROR`, `downloadUrl` is
  null — render nothing (the scan badge already explains why).
- Wrap the table in `overflow-x-auto` (UC5).

### Empty state (UC8)
When `assets.length === 0`, render `<UEmpty icon="i-lucide-folder-open" label="No assets" />`
instead of the table (`UEmpty` + `i-lucide-folder-open` both confirmed present in `@nuxt/ui@4.6.1` /
`@iconify-json/lucide`, verified 2026-07-06).

### `tenantName` for `showTenant`
`Asset` carries `tenantId` (uuid), not a name. The `AllAssets` GraphQL query selects the tenant name
via the shadow-table relation, which inflects as **`tenant { name }`** (verified 2026-07-06 — **not**
`storageTenant`, and not `storageTenantByTenantId`). `useSiteAssets` folds it onto the fnb-types
`Asset` as `tenantName` (`toAsset` alone sets it `null`, since the mapper doesn't see the relation).

## Open Questions (components)
- [x] `UFileUpload` availability — resolved: present in `@nuxt/ui@4.6.1`, no fallback needed. It uses
  `defineModel` (v-model → single `File` when `multiple=false`), `accept` (String), emits `change`.
- [x] Icons verified 2026-07-06: `i-lucide-upload`, `i-lucide-download`, `i-lucide-folder-open` all
  exist in the installed `@iconify-json/lucide`; storage-app declares `@iconify-json/lucide` directly.
- [x] `tenantName` relation field name post-codegen — it is **`tenant`** (type `StorageTenant`).
- [ ] How tenant-app later consumes these components for todo/ticket detail pages — recommended:
  add storage-layer to tenant-app's `extends` (layers compose; msg-layer → tenant-layer precedent).
