# Assets Page — UI (`/storage/assets`)

## Status
**Implemented & verified 2026-07-06** (Phase 9). `packages/storage-layer/app/pages/assets/index.vue`
at **`/storage/assets`** (storage-app); one RLS-scoped page serves both super-admins (all tenants)
and regular users (own tenant). Verified end-to-end: upload (`NO_CONTEXT`) → 202 PENDING → scan →
Clean → download (private presigned + public direct). Nav tool shipped to the DB (goes live on reseed).

**v2 (2026-07-06 spec / 2026-07-07 implemented) — image processing:** the page layout and props are
**unchanged**, but the components it embeds gained v2 behavior (documented in `components.ui.md`):
the `AssetUploader` is now a **staged** flow (Tags input + "Generate AI tags" checkbox + explicit
Upload button — so the ad-hoc `NO_CONTEXT` uploads here can exercise tags/AI-tags too), and
`AssetList` gained a Tags column. Thumbnail children never appear in this list (the `AllAssets`
query filters `parentAssetId: null` — `graphql.data.md`). No edits to the layout/state/interactions
below were required for v2. **Implemented 2026-07-07**. Driven by
`.claude/issues/addressed/0350__storage___asset-image-thumbnails__________LOW__.plan.md`.

The assets view. Lists the assets the caller can see under RLS — **every tenant's** for a
super-admin, **own tenant's** for everyone else — and hosts the reusable uploader (ad-hoc
`NO_CONTEXT` uploads, useful for verifying the pipeline end-to-end). Data contract in
`assets-page.data.md`; reusable components in `components.ui.md`; shared types + badge colors in
`_shared.data.md`.

- **Page file:** `packages/storage-layer/app/pages/assets/index.vue` (inherited by storage-app)
- **Route:** `/storage/assets`
- **Permission:** page requires a signed-in `p:app-user` (upload + own-tenant list). The
  cross-tenant view needs no extra gate — RLS (`manage_all_super_admin`) simply returns more rows
  for super-admins. Client guard for UX: mirror the `canSupport` computed pattern
  (`apps/tenant-app/app/pages/site-admin/tenant/index.vue:12`) to decide whether to show the
  Tenant column (`showTenant = user has p:app-admin-super`) and to redirect anonymous visitors.

## Nav registration (DB-seeded, cross-app link)

The planned `tenant-site-admin-assets` tool now points **cross-app** at storage-app — precedent:
`tenant-site-admin-wf` → `/graphql-api/workflow` in the same `_modules` array. Add to the
`site-admin` module in `db/fnb-app/deploy/00000000010240_app_fn.sql` (sqitch change/rework on
`fnb-app`, **not** a hand edit to a deployed DB):
```sql
,row('tenant-site-admin-asset-manager'::citext,'Asset Manager'::citext,'{"p:app-admin-super"}'::citext[],
     'i-lucide-grid-3x3'::citext,'/storage/assets',0)::app_fn.tool_info
```
Shipped 2026-07-06 in `db/fnb-app/deploy/00000000010240_app_fn.sql` (in the `site-admin` module tool
list, alongside `tenant-site-admin-wf` → `/graphql-api/workflow`). Key `tenant-site-admin-asset-manager`,
label "Asset Manager", icon `i-lucide-grid-3x3` (verified present in `@iconify-json/lucide`). It goes
live when the DB is reseeded (rebuild). Open question (recorded): a second, tenant-level nav tool
gated `p:app-user` so non-admins can reach their own assets — deferred; the page works for any user
via direct URL meanwhile.

## Layout

```
<div class="space-y-5 p-6 sm:p-9">
  <PageHeader title="Assets" :subtitle="subtitle" />   <!-- "N assets" / "N assets across the platform" for super-admin -->

  <!-- ad-hoc upload (NO_CONTEXT) for testing end-to-end -->
  <AssetUploader context="NO_CONTEXT" :owning-entity-id="null" @uploaded="onUploaded" />

  <div class="overflow-hidden rounded-[10px] border border-default bg-default">
    <AssetList :assets="assets" :show-tenant="isSuperAdmin" />   <!-- reusable; see components.ui.md -->
  </div>
</div>
```

- Responsive (UC5): table inside `AssetList` uses `overflow-x-auto`.
- `<AssetList>` renders `<UEmpty>` when `assets` is empty (UC8) — page shows no bare empty table.
- Toasts for upload feedback come from the uploader/composable (UC7).
- `show-tenant` only for super-admins (regular users see a single-tenant list; the column is noise).
- `PageHeader` lives in **`apps/tenant-app/app/components/`** (the app, not tenant-layer), so
  storage-layer does **not** inherit it — resolved 2026-07-06 by **duplicating** it into
  `packages/storage-layer/app/components/PageHeader.vue`.

## Reactive state

```ts
const { user } = useAuth()
const isSuperAdmin = computed(() => user.value?.permissions?.includes('p:app-admin-super'))
const { assets, fetching, error, refresh } = useSiteAssets()   // GraphQL, RLS-scoped
function onUploaded() { refresh() }  // refresh() wraps executeQuery({ requestPolicy: 'network-only' })
```

Page calls composables only (R1); no API calls in components except the uploader owning its own POST
(a deliberate, documented exception — see `components.ui.md`).

## Interactions

| Trigger | Behavior |
|---------|----------|
| Page mount | `useSiteAssets()` loads assets (RLS: all tenants for super-admin, own tenant otherwise) |
| Upload via `AssetUploader` | Component POSTs (202); on success emits `uploaded` → page calls `refresh()`; new row appears with the `Malware scan pending…` badge |
| Refresh (manual / after upload) | `PENDING` rows flip to `Clean` once the workflow finishes; download button appears |
| Click a row's Download | Open `asset.downloadUrl` in a new tab (private: presigned 15-min, saves under original filename; public: direct unsigned). Only rendered when `downloadUrl !== null` |
| Click a row's **name** (detail — implemented) | Client-side navigate to the asset detail page via base-relative `to="/assets/[id]"` (renders as `/storage/assets/[id]`) — all metadata, uploader/tenant, derived children, workflow link, Delete. See `asset-detail.ui.md` |

## Decided
- **Upload-capable** — the page hosts `<AssetUploader context="NO_CONTEXT">` so the full
  upload → quarantine → scan → promote pipeline can be verified end-to-end early.
- v1 badge flip is by **refresh/poll**, not push (pg-notify later — see `asset-scan-workflow.data.md`).

## Open Questions (page)
- [x] Icons verified 2026-07-06: nav uses `i-lucide-grid-3x3`; `AssetList`/`AssetUploader` use
  `i-lucide-download`/`i-lucide-upload`/`i-lucide-folder-open` — all in `@iconify-json/lucide`,
  which storage-app declares directly.
- [x] `PageHeader` source — duplicated into storage-layer (it lives in tenant-app, not a layer).
- [ ] Tenant-level nav tool for non-admins (deferred).
