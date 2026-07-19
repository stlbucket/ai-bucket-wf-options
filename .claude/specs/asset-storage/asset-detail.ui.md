# Asset Detail Page — UI (`/storage/assets/[id]`)


> **URN stacking v2 (2026-07-10):** `storage.asset.context` (+ the `asset_context` enum) and
> `owning_entity_id` are **removed** — `subject_urn` is the only attach mechanism. Upload takes an
> optional `subjectUrn` form field (no `context`/`owningEntityId`); per-subject reads are
> `assetsBySubject` / `publicAssetsForSubjectList(_subjectUrn)` via `useSubjectAssets(subjectUrn)`;
> the quarantine key is `quarantine/{tenantId}/{subjectSeg}/{assetId}.{ext}`. Authoritative
> contract: `.claude/specs/urn-registry/stacking-v2.data.md`. `context`/`owning_entity_id`
> mentions below are historical.

## Status
**Implemented — 2026-07-07.** The detail view for a single asset: **all** of its
metadata (uploader + tenant, context/entity, visibility, size/type/checksum, tags, scan status), a
**preview** when it's an image, an **easy link to the processing (`asset-scan`) workflow**, its
**derived child assets** (thumbnails) shown as a gallery, a **Download**, and a **Delete** (with
confirmation). Data contract in `asset-detail.data.md`; shared types + badge colors in
`_shared.data.md`; reusable components in `components.ui.md`.

- **Page file:** `packages/storage-layer/app/pages/assets/[id].vue` (inherited by storage-app)
- **Route:** `/storage/assets/[id]` (reached by clicking a row on `/storage/assets` — see
  `assets-page.ui.md` / `components.ui.md` for the list→detail link)
- **Permission:** signed-in `p:app-user`. RLS decides visibility — own-tenant users see their
  tenant's asset; super-admins see any. An unknown/forbidden id renders a **not-found** card (never
  a raw error). Delete is gated by the same RLS (own-tenant users + super-admin — `_shared.data.md`).

## Layout

```
<div class="space-y-5 p-6 sm:p-9">
  <!-- back + title + primary actions -->
  <PageHeader :title="asset?.originalName ?? 'Asset'" subtitle="Asset detail">
    <template #actions>
      <UButton icon="i-lucide-arrow-left" variant="ghost" to="/storage/assets" label="Back" />
      <UButton v-if="asset?.downloadUrl" icon="i-lucide-download" :to="asset.downloadUrl"
               target="_blank" label="Download" />
      <UButton v-if="canDelete" icon="i-lucide-trash-2" color="error" variant="soft"
               label="Delete" @click="confirmOpen = true" />
    </template>
  </PageHeader>

  <!-- loading / error / not-found -->
  <div v-if="fetching">…skeleton…</div>
  <UAlert v-else-if="error" color="error" :title="error.message" />
  <UEmpty v-else-if="!asset" icon="i-lucide-file-question" label="Asset not found" />

  <template v-else>
    <div class="grid gap-5 lg:grid-cols-3">
      <!-- LEFT (2 cols): metadata definition list -->
      <UCard class="lg:col-span-2">
        <template #header><h3 class="font-medium">Details</h3></template>
        <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          … definition rows (see Metadata below) …
        </dl>
      </UCard>

      <!-- RIGHT (1 col): preview + scan + workflow link -->
      <UCard>
        <template #header><h3 class="font-medium">Preview & processing</h3></template>
        <!-- image preview when applicable -->
        <img v-if="isImage && asset.downloadUrl" :src="asset.downloadUrl"
             class="mb-4 max-h-64 w-full rounded-md object-contain bg-elevated" />
        <UIcon v-else name="i-lucide-file" class="mb-4 size-16 text-dimmed" />

        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted">Scan</span>
            <UBadge :color="scanColor" variant="subtle">{{ scanLabel }}</UBadge>
          </div>
          <!-- EASY LINK TO THE PROCESSING WORKFLOW -->
          <UButton v-if="asset.wfId" icon="i-lucide-workflow" variant="link" class="px-0"
                   :to="`/graphql-api/workflow/${asset.wfId}`" external
                   label="View processing workflow" :trailing-icon="'i-lucide-external-link'" />
          <p v-else class="text-sm text-dimmed">No workflow recorded.</p>
        </div>
      </UCard>
    </div>

    <!-- DERIVED CHILDREN (thumbnails) -->
    <UCard v-if="children.length">
      <template #header>
        <h3 class="font-medium">Derived assets <span class="text-muted">({{ children.length }})</span></h3>
      </template>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <!-- one card per child; see Children gallery below -->
      </div>
    </UCard>
  </template>

  <!-- delete confirmation modal -->
  <UModal v-model:open="confirmOpen" title="Delete asset?"> … see Delete below … </UModal>
</div>
```

- Responsive (UC5): `grid-cols-1 sm:grid-cols-2` on the metadata list; children gallery wraps.
- UCard is the content container (UC4); Nuxt UI components throughout (UC3); color tokens only (UC6).
- Toasts (`useToast`) for delete feedback (UC7); `UAlert` only for the persistent load error.
- `PageHeader` is the storage-layer duplicate (`assets-page.ui.md` — it isn't inherited from tenant-app).

## Metadata (the "all info about the asset" definition list)

Each row is `<dt class="text-sm text-muted">…</dt><dd>…</dd>`. Show:

| Label | Value | Notes |
|---|---|---|
| Uploaded by | `asset.uploaderName ?? '—'` | resident `displayName` (new `resident` relation — `asset-detail.data.md`) |
| Tenant | `asset.tenantName ?? '—'` | from the `tenant` relation; most useful for super-admins |
| Context | `<UBadge>` | context color map (`_shared.data.md`) |
| Entity id | `asset.owningEntityId ?? '—'` | monospace; the `todo`/`support-ticket` this file hangs off |
| Visibility | `<UBadge :color="isPublic ? 'warning' : 'neutral'">` | `Public` / `Private` |
| Type | `asset.contentType` | |
| Size | humanized `asset.sizeBytes` | e.g. `1.2 MB` |
| Extension | `asset.extension` | |
| Tags | one `<UBadge variant="subtle">` per tag | `flex flex-wrap gap-1`; empty → `—` |
| Scan status | `<UBadge>` | scan color map; also mirrored in the right card |
| Status | `<UBadge :color="assetStatus === 'ACTIVE' ? 'success' : 'neutral'">` | `Active` / `Deleted` |
| Uploaded | localized `asset.createdAt` | |
| Updated | localized `asset.updatedAt` | |
| ~~Checksum~~ | — | **Dropped (2026-07-07).** `checksum_sha256` stays hidden from the fragment/fnb-types; not surfaced. Revisit as super-admin-only later if wanted. |

> Note on **Checksum**: the column exists in the DB but is **not** in the exposed `Asset` fragment
> or fnb-types, and was **not** surfaced (decision 2026-07-07 — marginal value, would require
> unhiding the column + fragment + type churn). Everything else above is already on `Asset` (plus
> the two new relation-derived fields `uploaderName`/`tenantName`).

## Children gallery (derived thumbnails — "a good way to view them easily")

v1 children are the 256px webp **thumbnails** (`parentAssetId = asset.id`, born `clean`, `tags`
includes `thumbnail`). They never appear in any list (`graphql.data.md`); the detail page is the
one place they surface. Render each as a small card:

```
<div v-for="c in children" :key="c.id" class="rounded-md border border-default p-2">
  <img v-if="isImageType(c.contentType) && c.downloadUrl" :src="c.downloadUrl"
       class="mb-2 aspect-square w-full rounded object-cover bg-elevated" />
  <UIcon v-else name="i-lucide-image" class="mb-2 size-10 text-dimmed" />
  <div class="flex items-center justify-between gap-1">
    <UBadge variant="subtle" color="neutral">{{ c.tags.includes('thumbnail') ? 'Thumbnail' : 'Derived' }}</UBadge>
    <UButton v-if="c.downloadUrl" icon="i-lucide-download" size="xs" variant="ghost"
             :to="c.downloadUrl" target="_blank" />
  </div>
</div>
```

- Public thumbnails resolve to a direct unsigned URL; private ones to a 15-min presigned URL — both
  usable directly as an `<img src>` (`graphql.data.md` §3). A `PENDING` child can't exist (children
  are born `clean`), so `downloadUrl` is effectively always present for a live child.
- The gallery is intentionally simple (grid of square previews). A lightbox/zoom is a later
  refinement (Open Questions) — the download button covers full-res access for v1.

## Scan status + workflow link (the "easy link to processing" requirement)

- The scan badge uses the `scanStatus` color map (`_shared.data.md`): `PENDING` → neutral
  "Malware scan pending…", `CLEAN` → success, `INFECTED` → error, `ERROR` → warning "Scan error".
- **Workflow link:** `asset.wfId` is the `asset-scan` **workflow instance** id (captured at upload
  — `endpoint.data.md` / `_shared.data.md`). The button deep-links to the Workflow Dashboard's
  detail page: **`/graphql-api/workflow/${asset.wfId}`**. This is a **cross-app** link (storage-app
  → graphql-api-app), so it must be a hard navigation — use `:to` with **`external`** (or a plain
  `<a :href>`); both apps are served under the same nginx origin (`localhost:4000`), so the
  `session` cookie flows and the workflow page's RLS resolves the same tenant. Precedent: the
  site-admin nav tool `tenant-site-admin-wf` → `/graphql-api/workflow` (`assets-page.ui.md`).
- When `wfId` is null (older rows uploaded before the column existed, or a manual insert), show
  "No workflow recorded." instead of a dead link.

## Delete (confirmed, cascades to children)

- **Gate (UX):** `canDelete = isSuperAdmin || (user has p:app-user in asset.tenantId)`. The server
  is authoritative (RLS in `storage_api.delete_asset`); this only hides the button when the action
  would 404/403 anyway. For the site page's common case (super-admin viewing any tenant, or a user
  viewing their own tenant), `canDelete` is true.
- **Confirmation modal (UModal):** required (Q1 — "this should be confirmed, of course"):
  ```
  <UModal v-model:open="confirmOpen" title="Delete asset?">
    <template #body>
      <p>Delete <strong>{{ asset.originalName }}</strong>?</p>
      <p v-if="children.length" class="mt-2 text-sm text-warning">
        This also removes {{ children.length }} derived asset(s) (thumbnail).
      </p>
      <p class="mt-2 text-sm text-muted">The stored file is permanently removed. This cannot be undone.</p>
    </template>
    <template #footer>
      <UButton variant="ghost" label="Cancel" @click="confirmOpen = false" />
      <UButton color="error" label="Delete" :loading="deleting" @click="onDelete" />
    </template>
  </UModal>
  ```
- **On confirm** (`onDelete`): `await remove(asset.id)` (`useAssetDelete`, `asset-detail.data.md`).
  On success: `useToast().add({ color: 'success', title: 'Asset deleted' })` → close modal →
  `navigateTo('/assets')`. On failure: toast `error` with `messageForDeleteStatus` text;
  leave the modal open. Soft-delete + object purge + child cascade happen server-side in one call.

> **Base-relative links (implementation correction, 2026-07-07).** `NUXT_APP_BASE_URL=/storage`
> makes Nuxt auto-prepend the base to intra-app `<NuxtLink>`/`navigateTo`. Internal targets must be
> **base-relative** — `to="/assets"`, `:to="`/assets/${id}`"`, `navigateTo('/assets')` (NOT
> `/storage/assets`; that double-counts the base → client-side 404). Matches the tenant-app
> convention (`to="/loc"`). The workflow deep-link is the exception: it is **cross-app**, so it keeps
> the full origin path `/graphql-api/workflow/[wfId]` with `external` (no base prefix). Earlier
> `to="/storage/assets"` snippets in this file were corrected.

## Reactive state

```ts
const route = useRoute()
const { user } = useAuth()
const { asset, children, fetching, error, refresh } = useAssetDetail(route.params.id as string)
const { remove, deleting } = useAssetDelete()

const isSuperAdmin = computed(() => user.value?.permissions?.includes('p:app-admin-super'))
const canDelete = computed(() => isSuperAdmin.value
  || !!(asset.value && user.value?.permissions?.includes('p:app-user')))   // RLS re-checks tenant
const isImage = computed(() => isImageType(asset.value?.contentType))
const confirmOpen = ref(false)
```

Page calls composables only (R1). No API calls in components (R2) — the delete `$fetch` is owned by
the page's `useAssetDelete` composable, not a child component.

## Interactions

| Trigger | Behavior |
|---------|----------|
| Navigate from list row | `useAssetDetail(id)` loads the asset + its children |
| Asset still `PENDING` | scan badge shows "Malware scan pending…"; no Download; `refresh()` reveals the verdict |
| Click **Download** | open `asset.downloadUrl` in a new tab (public: direct; private: presigned 15-min under the original filename) — rendered only when `downloadUrl !== null` |
| Click **View processing workflow** | hard-navigate to `/graphql-api/workflow/[wfId]` (cross-app) |
| Click a child's download | open the thumbnail's `downloadUrl` in a new tab |
| Click **Delete** → confirm | REST delete (soft-delete + purge + child cascade) → toast → back to `/storage/assets` |

## Decided
- **Delete is soft-delete + object purge, cascading to derived children** (row retained for audit;
  MinIO object(s) removed) — decision 2026-07-07.
- **Delete requires confirmation** (UModal) — per the request.
- **Workflow link deep-links to the instance** via a stored `wf_id` (not the dashboard list) —
  decision 2026-07-07.
- Children shown as a **simple responsive thumbnail grid** on the detail page (the only view that
  surfaces derived assets).

## Resolved (was Open Questions — page UI)
- [x] Surface the **checksum** row? → **No** (2026-07-07). Not surfaced; `checksum_sha256` stays
  hidden from the fragment/fnb-types. Revisit as super-admin-only later if wanted.
- [x] Verify `i-lucide-*` names (UC11) → **all confirmed present** in the installed
  `@iconify-json/lucide` collection: `arrow-left`, `download`, `trash-2`, `workflow`,
  `external-link`, `file`, `file-question`, `image` (storage-app declares it directly —
  `iconify-collection-per-app`).
- [x] Soft-deleted asset reachable at its detail URL? → **Yes** — the detail page renders it with a
  `Deleted` status badge and no working `downloadUrl` (the §4 presign gate returns null for
  `asset_status != 'active'`). It is not hard-404'd.

## Open Questions (page UI) — deferred, not blocking
- [ ] Lightbox/zoom for image previews + children (v1: inline `<img>` + download only).
