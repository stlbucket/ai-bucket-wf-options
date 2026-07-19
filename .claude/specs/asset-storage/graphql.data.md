# Asset Storage — GraphQL Layer


> **URN stacking v2 (2026-07-10):** `storage.asset.context` (+ the `asset_context` enum) and
> `owning_entity_id` are **removed** — `subject_urn` is the only attach mechanism. Upload takes an
> optional `subjectUrn` form field (no `context`/`owningEntityId`); per-subject reads are
> `assetsBySubject` / `publicAssetsForSubjectList(_subjectUrn)` via `useSubjectAssets(subjectUrn)`;
> the quarantine key is `quarantine/{tenantId}/{subjectSeg}/{assetId}.{ext}`. Authoritative
> contract: `.claude/specs/urn-registry/stacking-v2.data.md`. `context`/`owning_entity_id`
> mentions below are historical.

## Status
**Implemented & verified 2026-07-06** (Phases 7–8): `storage` schema exposed (reads only),
`storage_key`/`bucket` hidden via smart tags, nullable `downloadUrl` presign plugin live (gated on
`CLEAN`; public = direct unsigned, private = 15-min presigned against the browser-reachable
endpoint), fragment + `AllAssets`/`AssetsByOwningEntity`/`PublicAsset`/`PublicAssetsForEntity` ops,
`toAsset` mapper, and `useSiteAssets()` composable. Inflected names and the two presign gotchas
(snake_case `.get()`, browser-reachable signing endpoint) were corrected against the live run — see
§3–§4.

**v2 (2026-07-06 spec / 2026-07-07 implemented) — image processing:** `Asset` gains `tags` +
`parentAssetId` (fragment, fnb-types, mapper), and the list queries filter to **originals only**
(`parentAssetId` null — thumbnail children are hidden from all lists, locked decision; a child
stays reachable by reference via `publicAsset(_id:)` or its parent). **Implemented 2026-07-07** —
codegen re-run against the live schema (`AssetFragment` carries `tags` + `parentAssetId`); verified
via PostGraphile explain that explicit `parentAssetId: null` compiles to SQL
`where (parent_asset_id is null)`, so no composable-filter fallback was needed; `pnpm build` green.
Sections marked **(v2 draft)**.

**detail (2026-07-07 — implemented) — asset detail page:** `Asset` gains **`wfId`** (fragment,
fnb-types, mapper); a new **`AssetDetail($id: UUID!)`** query returns the asset by PK with the
`tenant { name }` + `resident { displayName }` relations and its derived `children`
(`assetsList(condition: { parentAssetId: $id })`); the `downloadUrl` presign plugin now also returns
**null when `asset_status != 'active'`** (soft-deleted). Inflected names verified via live
introspection: by-PK accessor `asset(id:)`, uploader relation `resident { displayName }` (a
`StorageResident` node), `tenant { name }`. Codegen re-run; `useAssetDetail()` composable added and
barrel-exported; `pnpm build` green.

**entity (2026-07-09 — implemented, issue 0330):** `AssetsByOwningEntity` gains
`assetStatus: ACTIVE` (the W3 soft-delete visibility split — `_shared.data.md`; `AllAssets`
deliberately unfiltered); `useEntityAssets()` composable implemented + barrel-exported (§4);
tenant-app now extends storage-layer (thin re-export `apps/tenant-app/app/composables/
useEntityAssets.ts`, `NUXT_PUBLIC_UPLOAD_URL` on its compose service).

Reads (list + download) go through **PostGraphile GraphQL** in `graphql-api-app`. The `storage.asset`
table is exposed as the `Asset` type, with a **computed `downloadUrl` field** that returns either a
short-lived **presigned** URL (private assets) or a **direct unsigned** URL (public assets) — and
**null while `scanStatus` is not `CLEAN`** (quarantine-first gating; see
`asset-scan-workflow.data.md`). Upload stays REST, served by **storage-app** (`endpoint.data.md`).
graphql-api-app's only S3 involvement is **presigning** (a local HMAC — no S3 round-trip, no
PutObject); all object writes live in storage-layer.

Public assets are read by `anon` **only by reference** — via the `publicAsset(id:)` /
`publicAssetsForEntity(...)` SECURITY DEFINER functions (exposed from the `storage` schema), never by
listing the table. `anon` has no table grant, so it cannot enumerate (P4). Both functions filter
`is_public` **and `scan_status = 'clean'`** (quarantine-first rework — see `_shared.data.md`).

---

## 1. Expose the schema

`apps/graphql-api-app/server/graphile.config.ts` — add **only the `storage` schema** (the table, for
reads) to the `makePgService({ schemas: [...] })` array (currently
`['app','app_api','msg','msg_api','loc','loc_api','todo','todo_api','wf','wf_api']`):
```ts
schemas: [ ..., 'storage' ]   // NOT storage_api / storage_fn
```
**Do NOT expose `storage_api` — a deliberate exception to the house pattern.** Every other module
exposes its `*_api` schema so its gate functions surface as GraphQL mutations (e.g.
`submitSupportTicket`). `storage_api` must stay hidden: exposing it would publish `insert_asset` as
a mutation — letting any `p:app-user` insert an asset row with a **forged `storage_key` and
`scan_status: 'clean'` without ever uploading or scanning a file** (and then mint a presigned
`downloadUrl` for an object it never owned). The upload endpoint calls `storage_api.insert_asset`
via **raw `pg`**, which works regardless of GraphQL exposure. `storage_fn` stays hidden like every
other `*_fn` schema.

Note the preset already sets `disableDefaultMutations: true` (v4 preset), so exposing the `storage`
table creates **no** CRUD mutations — reads only. It also sets `simpleCollections: 'both'` +
`PgSimplifyInflectionPreset`, so the table surfaces as both `assets` (connection) and `assetsList`
(list) — house convention is the **list form**.

RLS still applies: the request runs as `role: authenticated` with `request.jwt.claims`, so:
- regular users see only their tenant's assets (`manage_all_for_tenant`),
- super-admins see all tenants' assets (`manage_all_super_admin`) — together these are what let one
  `/storage/assets` page serve both audiences,
- `anon` has no table grant → the table query fields (`assets` / `assetsList`) error for anon;
  anon reads public assets only through the exposed `storage.public_asset` /
  `storage.public_assets_for_entity` functions (which hard-filter `is_public` + `clean`).

## 2. Hide internal columns

Do **not** expose `storage_key` or `bucket` (internal object location). The app already loads a smart
tags file at **`apps/graphql-api-app/postgraphile.tags.json5`** (via `TagsFilePlugin` in
`graphile.config.ts`). Add an `asset` class entry with attribute behaviors:
```json5
// apps/graphql-api-app/postgraphile.tags.json5  →  config.class
// NOTE: the v5 behavior names are `filterBy`/`orderBy` — `-filter -order` silently does nothing.
asset: {
  attribute: {
    storage_key: { tags: { behavior: '-select -filterBy -orderBy' } },
    bucket:      { tags: { behavior: '-select -filterBy -orderBy' } },
  },
},
```
The columns stay in the DB (the `downloadUrl` plan still reads them server-side) but are removed from
the exposed schema. Clients get metadata + `downloadUrl` only.

## 3. `downloadUrl` computed field (presign plugin)

Add a `makeExtendSchemaPlugin` (same family as `server/api/mutation-hooks/*` plan wrappers) that adds
`downloadUrl: String` (**nullable**) to the `Asset` type. The grafast plan reads the row's columns
and returns a `lambda` that **short-circuits to null unless the scan verdict is CLEAN**, otherwise
presigns:

```ts
// server/graphile/asset-download-url.plugin.ts  (added to preset.plugins)
import { makeExtendSchemaPlugin, gql } from 'postgraphile/utils'
import { lambda } from 'postgraphile/grafast'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../lib/s3.js'   // graphql-api-app local S3 client — SIGNING ONLY (no writes)

const TTL = 15 * 60   // 15 minutes (locked)
const PUBLIC_BASE = process.env.S3_PUBLIC_BASE_URL   // e.g. dev: http://localhost:9000/fnb-assets

// Strip characters that would break the Content-Disposition header value.
function sanitizeHeader(name: string): string {
  return name.replace(/["\\\r\n]/g, '_')
}

export const AssetDownloadUrlPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`extend type Asset { downloadUrl: String }`,   // nullable — null while not CLEAN
  plans: {
    Asset: {
      downloadUrl($asset) {
        // grafast .get() uses the RAW DB column names (snake_case), NOT the inflected GraphQL
        // field names — camelCase throws `PgResource(asset) does not define an attribute named …`.
        // The scan compare is also against the raw lowercase enum value ('clean'), not 'CLEAN'.
        const $scan   = $asset.get('scan_status')
        const $status = $asset.get('asset_status')     // null out soft-deleted assets (detail phase)
        const $public = $asset.get('is_public')
        const $bucket = $asset.get('bucket')
        const $key    = $asset.get('storage_key')     // still readable in plan even if hidden from API
        const $name   = $asset.get('original_name')
        const $type   = $asset.get('content_type')
        return lambda([$scan, $status, $public, $bucket, $key, $name, $type],
                      async ([scan, assetStatus, isPublic, bucket, key, name, type]) => {
          if (assetStatus !== 'active') return null      // soft-deleted → no URL (object purged anyway)
          if (scan !== 'clean') return null              // quarantine-first gate: PENDING/INFECTED/ERROR → no URL
          if (isPublic) return `${PUBLIC_BASE}/${key}`   // direct, unsigned, stable (public/ prefix is anon-readable)
          return getSignedUrl(s3, new GetObjectCommand({  // private → short-lived signed link
            Bucket: bucket, Key: key,
            ResponseContentDisposition: `attachment; filename="${sanitizeHeader(name)}"`,
            ResponseContentType: type,
          }), { expiresIn: TTL })
        })
      },
    },
  },
}))
```

> **Verified 2026-07-06 (live run) — two corrections baked in above:**
> 1. **`$asset.get()` takes raw snake_case column names** (`scan_status`, `is_public`, `storage_key`,
>    `original_name`, `content_type`) — camelCase throws at query time for every row.
> 2. **The signing S3 client (`server/lib/s3.ts`) must presign against the BROWSER-reachable
>    endpoint**, not the internal `S3_ENDPOINT=http://minio:9000` (a SigV4 URL is Host-bound, so a
>    URL signed for `minio:9000` is unreachable from the browser and can't be rewritten client-side).
>    Derive it from `S3_PUBLIC_BASE_URL`'s origin (dev: `http://localhost:9000`; prod: the public
>    S3/CDN origin), falling back to `S3_ENDPOINT`:
>    ```ts
>    const presignEndpoint = process.env.S3_PUBLIC_BASE_URL
>      ? new URL(process.env.S3_PUBLIC_BASE_URL).origin
>      : process.env.S3_ENDPOINT
>    export const s3 = new S3Client({ endpoint: presignEndpoint, region: process.env.S3_REGION,
>      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
>      credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! } })
>    ```
>    (The public branch already used `S3_PUBLIC_BASE_URL` directly, so only private/presigned
>    downloads were affected.)

Key points:
- **The null gate comes first**: `PENDING`/`INFECTED`/`ERROR` rows never mint a URL of either kind
  — while pending the object is under `quarantine/` anyway (not anon-readable, and a presigned URL
  to it must never exist).
- **Public assets** (clean) return a direct `${S3_PUBLIC_BASE_URL}/${storageKey}` — no signing, no
  expiry, cacheable/CDN-friendly. Requires the `public/*` prefix to be anonymously readable in MinIO
  (`infrastructure.md`) and a browser-reachable `S3_PUBLIC_BASE_URL`. Public objects serve inline
  under the uuid name (no `ResponseContentDisposition` override possible on an unsigned URL).
- **Private assets** presign as before. **Presigning is a local HMAC operation** (no S3 round-trip),
  so per-row generation in a list query is cheap; `lambda` batches naturally.
- `ResponseContentDisposition` restores the **original filename** for private downloads even though
  the object key is `[uuid].[ext]` (the reason UUID-on-disk is free of downsides).
- Also expose `isPublic` on the `Asset` type (it's a normal column — no tag needed) so the UI can
  badge public assets.
- The plan can still `.get('storageKey')` / `.get('bucket')` even though those columns are hidden from
  the public schema by the smart tags — the behavior tags affect the exposed API, not the plan's
  access to the underlying select.
- Register the plugin in `preset.plugins` alongside `TagsFilePlugin` and `...mutationHooks`.
- **`s3` client** here is graphql-api-app-local (`server/lib/s3.ts`) and used for **signing only**;
  storage-layer has its own client for the upload PutObject, and worker-app a third for the scan
  pipeline's Get/Copy/Delete. Each is ~15 lines of env-driven config — deliberate small
  duplication rather than a shared package (`infrastructure.md` §1e).

## 4. Fragment, queries + client composables (fnb-types/mapper pattern — updated 2026-07-06)

House conventions (verified against the `support` module):
- One **fragment per entity** selecting **every exposed field** — never trimmed to fit a page.
- Queries use the **list form** (`assetsList`, simple collections), usually aliased.
- Generated types stay internal; a **mapper** bridges `AssetFragment` → fnb-types `Asset`.

Add under `packages/graphql-client-api/src/graphql/storage/`:

```graphql
# fragment/Asset.graphql — ALL exposed fields (storageKey/bucket are hidden by tags; downloadUrl is computed)
# (v2 draft) gains `tags` + `parentAssetId` — the fragment always selects every exposed field (R3).
fragment Asset on Asset {
  nodeId
  id
  tenantId
  residentId
  createdAt
  updatedAt
  context
  owningEntityId
  isPublic
  originalName
  extension
  contentType
  sizeBytes
  scanStatus
  assetStatus
  downloadUrl
  tags              # (v2 draft)
  parentAssetId     # (v2 draft)
  wfId              # (detail) asset-scan workflow instance id → detail-page deep link
}

# query/allAssets.graphql — site-admin, cross-tenant (RLS returns all rows for super-admin)
# NOTE: the tenant relation inflects as `tenant` (type StorageTenant), NOT `storageTenant`.
# (v2 draft) condition parentAssetId: null → originals only (thumbnail children hidden from lists).
# PostGraphile treats an EXPLICIT null condition value as IS NULL — verify in GraphiQL at
# implementation time (an omitted field means "no filter"; explicit null means "must be null").
query AllAssets {
  assets: assetsList(condition: { parentAssetId: null }, orderBy: CREATED_AT_DESC) {
    ...Asset
    tenant { name }   # → folded into `tenantName` by the useSiteAssets composable
  }
}

# query/assetsByOwningEntity.graphql — authed per-entity use (todo/ticket pages); own-tenant via RLS
# (v2 draft) same originals-only condition.
# assetStatus: ACTIVE (W3 split, 2026-07-09 — issue 0330): entity pages never show soft-deleted
# rows; AllAssets deliberately stays unfiltered (operator visibility). See _shared.data.md.
query AssetsByOwningEntity($context: AssetContext!, $owningEntityId: UUID!) {
  assets: assetsList(
    condition: {
      context: $context
      owningEntityId: $owningEntityId
      parentAssetId: null
      assetStatus: ACTIVE
    }
    orderBy: CREATED_AT_DESC
  ) {
    ...Asset
  }
}

# query/publicAssetsForEntity.graphql — ANON-safe (SECURITY DEFINER fn; is_public+clean; by reference)
# NOTE: the fn args keep their `_` prefix — PgSimplifyInflection does NOT strip it.
query PublicAssetsForEntity($context: AssetContext!, $owningEntityId: UUID!) {
  assets: publicAssetsForEntityList(_context: $context, _owningEntityId: $owningEntityId) {
    ...Asset
  }
}

# query/publicAsset.graphql — ANON-safe single fetch by id (arg is `_id`, not `id`)
query PublicAsset($id: UUID!) {
  assets: publicAssetList(_id: $id) {
    ...Asset
  }
}

# query/assetDetail.graphql — (detail) the /storage/assets/[id] page: one asset (by PK) with
# its uploader + tenant relations, PLUS its derived children (the ONE place children are queried;
# every list filters parentAssetId: null). Own-tenant via RLS; super-admin sees any tenant.
# VERIFIED (2026-07-07, live introspection): by-PK accessor `asset(id:)` (NOT `assetById`); uploader
# relation `resident { displayName }` (a StorageResident node, NOT `storageResident`/
# `residentByResidentId`); `tenant { name }` (StorageTenant).
query AssetDetail($id: UUID!) {
  asset(id: $id) {
    ...Asset
    tenant { name }             # → tenantName
    resident { displayName }    # → uploaderName (NEW relation on the fragment's parent select)
  }
  children: assetsList(condition: { parentAssetId: $id }, orderBy: CREATED_AT_DESC) {
    ...Asset
  }
}
```
The `downloadUrl` computed field applies to function results too (same `Asset` type) — public assets
resolve to a direct unsigned URL.

**Inflected names — verified 2026-07-06 (GraphiQL + codegen), no longer `[FILL IN]`:**
`assetsList`, `AssetContext` (`NO_CONTEXT`/`TODO`/`SUPPORT_TICKET`), `AssetsOrderBy.CREATED_AT_DESC`,
`AssetCondition` (`context`/`owningEntityId`/`isPublic`), the tenant relation **`tenant`** (type
`StorageTenant`, **not** `storageTenant`), and the setof-fn list variants `publicAssetList(_id:)` /
`publicAssetsForEntityList(_context:, _owningEntityId:)` (leading `_` retained on the fn args).

- **fnb-types:** add `Asset` + enum unions to `packages/fnb-types/src/asset.ts` (UPPERCASE GraphQL
  values verbatim, `Date` timestamps); barrel-export from `src/index.ts`. See `_shared.data.md`.
- **Mapper:** `packages/graphql-client-api/src/mappers/asset.ts` — `toAsset(f: AssetFragment): Asset`
  (String() ids, `new Date(...)`, enum pass-through; mirror `mappers/support-ticket.ts`).
  **(v2 draft)** adds `tags: (f.tags ?? []).filter(Boolean).map(String)` (un-Maybe the array) and
  `parentAssetId: f.parentAssetId ?? null`. **(detail)** adds `wfId: f.wfId != null ? String(f.wfId) : null`.
- `pnpm -F @function-bucket/fnb-graphql-client-api generate` → regenerates
  `src/generated/fnb-graphql-api.ts` (`useAllAssetsQuery`, `useAssetsByOwningEntityQuery`, …).
- Wrapper composables in `packages/graphql-client-api/src/composables/`:
  - `useSiteAssets()` → wraps `useAllAssetsQuery`; maps nodes as
    `{ ...toAsset(n), tenantName: n.tenant?.name ?? null }` (the `tenant` relation is selected next to
    the fragment, so the mapper alone doesn't see it — `toAsset` sets `tenantName: null`); returns
    `{ assets: ComputedRef<Asset[]>, fetching, error, refresh }` where `refresh()` wraps
    `executeQuery({ requestPolicy: 'network-only' })` (mirror `useSupportTickets`).
  - `useEntityAssets(context, owningEntityId)` → wraps `useAssetsByOwningEntityQuery` —
    **implemented 2026-07-09 (issue 0330)**: `context: AssetContext` (fnb-types),
    `owningEntityId: MaybeRef<string>` (reactive variables); maps nodes via `toAsset`; returns
    `{ assets: ComputedRef<Asset[]>, fetching, error, refresh }` (`refresh()` =
    `executeQuery({ requestPolicy: 'network-only' })`). Barrel-exported; thin re-export in
    `apps/tenant-app/app/composables/useEntityAssets.ts` (tenant-app extends storage-layer).
  - **(detail)** `useAssetDetail(id: MaybeRef<string>)` → wraps `useAssetDetailQuery`; returns
    `{ asset: ComputedRef<AssetDetailView | null>, children: ComputedRef<Asset[]>, fetching, error,
    refresh }`. `asset` maps the node via `toAsset` and folds `tenantName: n.tenant?.name ?? null`
    + `uploaderName: n.resident?.displayName ?? null` (the relations sit next to the fragment, so
    the mapper alone doesn't see them). `AssetDetailView = Asset & { uploaderName: string | null }`
    (R4). Barrel-export it. See `asset-detail.data.md`.
- Barrel: `export * from './composables/useSiteAssets'` **and `export * from './composables/useAssetDetail'`**
  in `packages/graphql-client-api/src/index.ts`.
  The barrel deliberately does **not** re-export the generated module (internal detail).
- Rebuild: `pnpm -F @function-bucket/fnb-graphql-client-api build`.
- storage-layer re-export (`packages/storage-layer/app/composables/useSiteAssets.ts`):
  ```ts
  export { useSiteAssets } from '@function-bucket/fnb-graphql-client-api'
  export type { Asset } from '@function-bucket/fnb-types'
  ```

## 5. urql plugin (storage-app)

The assets page consumes GraphQL, so storage-app needs the standard urql client plugin
(`app/plugins/urql.client.ts` with `preferGetMethod: false` — PostGraphile rejects GET with 405 —
and `url: runtimeConfig.public.graphqlApiUrl`). `fnb-create-app` scaffolds this; mirror
`apps/tenant-app/app/plugins/urql.client.ts`.

## 6. Docker

`packages-watch` must build/watch `fnb-graphql-client-api` (it already does per CLAUDE.md). After
adding npm deps, `docker compose up pnpm-install --force-recreate` then restart
`packages-watch` + `storage-app` + `graphql-api-app`.

## Open Questions (GraphQL)
- [x] Verify PostGraphile inflected names — done 2026-07-06 (see the "Inflected names — verified"
  note in §4). Corrections applied: tenant relation `tenant` (not `storageTenant`); fn args
  `_id` / `_context` / `_owningEntityId` (leading `_` retained).
- [ ] Pagination for the site-admin view — house list queries are currently unpaginated
  (`supportTicketsList` style); start unpaginated and add `first`/`offset` if volume demands it.
- [x] (v2) Verify at implementation: explicit `parentAssetId: null` in `AssetCondition`
  compiles to `IS NULL` — **confirmed 2026-07-07** via PostGraphile explain (SQL
  `where (parent_asset_id is null)`); inflected names `tags` / `parentAssetId` present post-codegen.
  No composable-filter fallback needed.
- [ ] (v2 follow-on, not this phase) Render the thumbnail child in `AssetList` (swap the file
  icon for the child's `downloadUrl`) — needs a parent→child selection (relation inflects from
  the self-FK) or a second query; design when picked up.
- [x] (detail) Verify `AssetDetail` inflected names — **done 2026-07-07** (live introspection):
  `asset(id:)`, `resident { displayName }` (StorageResident), `tenant { name }` (StorageTenant).
- [x] (detail) `downloadUrl` also null for soft-deleted — **done 2026-07-07**: plan reads
  `asset_status` (raw snake_case) and returns null when `!= 'active'` (checked before the scan gate).
  Verified graphql-api-app boots clean and `Asset.downloadUrl` still resolves. §3.
