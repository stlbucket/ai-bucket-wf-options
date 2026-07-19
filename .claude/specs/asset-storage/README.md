# Asset Upload & Storage — Spec Index


> **URN stacking v2 (2026-07-10):** `storage.asset.context` (+ the `asset_context` enum) and
> `owning_entity_id` are **removed** — `subject_urn` is the only attach mechanism. Upload takes an
> optional `subjectUrn` form field (no `context`/`owningEntityId`); per-subject reads are
> `assetsBySubject` / `publicAssetsForSubjectList(_subjectUrn)` via `useSubjectAssets(subjectUrn)`;
> the quarantine key is `quarantine/{tenantId}/{subjectSeg}/{assetId}.{ext}`. Authoritative
> contract: `.claude/specs/urn-registry/stacking-v2.data.md`. `context`/`owning_entity_id`
> mentions below are historical.

> **Engine superseded 2026-07-17:** the wf/graphile-worker engine (and `apps/worker-app`) is
> retired — the asset-scan pipeline now runs as an **agentic workflow** in `apps/agent-app`
> (R22; `.claude/specs/agentic-workflow-engine/asset-scan.workflow.data.md`). The upload
> endpoint fires a post-commit trigger POST instead of `wf_api.queue_workflow`; the reaper is a
> croner job in agent-app; run visibility is `agent.workflow_run` + per-run transcripts (the
> Workflow Dashboard is gone). Worker/wf mentions below are historical.

## Status
**Implemented 2026-07-06.** Phases 1–10 complete (standalone `storage-app` + `storage-layer`,
quarantine-first scanning via the `asset-scan` wf workflow). Verified end-to-end for the clean
private + clean public paths (upload → 202 PENDING → scan → promote → download). Phase 11 residuals
(EICAR/oversize/wrong-type + Workflow Dashboard visibility) are the only open verification items.
Live-run corrections were folded back into the per-file specs (presign `.get()` snake_case + signing
endpoint in `graphql.data.md`; inflected names; `PageHeader` duplication; the worker migrate-race fix).

**Final-eval follow-ups landed 2026-07-06/07:** Plan A (reachable terminal `error` verdict +
two-phase reaper with workflow-attempt cap), Plan C (image pins, `DEPLOY_PACKAGES` compose default,
quarantine `mc ilm` expiry), and **Plan D — the scan worker and ALL wf task handlers moved to
`apps/worker-app`**, a headless compose service that is the stack's single graphile-worker
migrator + runner (kills the fresh-DB schema-install race structurally; storage-layer keeps only
the upload endpoint; graphql-api-app keeps presign + the lazy `_scheduleUows` producer).

**v2 draft (2026-07-06) — image processing (specced, not yet implemented):** ffmpeg thumbnails
(256px webp child assets via `parent_asset_id`, born clean, hidden from all lists), an AI-tagging
stub step (opt-in at upload → `ai-tags-coming-soon` tag), user tags (comma-delimited at upload),
and a staged `AssetUploader`. The `asset-scan` DAG becomes a diamond (scan → resolve →
thumbnail ∥ ai-tag); worker-app gets a dedicated Dockerfile with ffmpeg. Sections marked
**(v2 draft)** across `_shared.data.md`, `endpoint.data.md`, `asset-scan-workflow.data.md`,
`graphql.data.md`, `components.ui.md`, `assets-page.data.md`, `infrastructure.md`. Plan:
`.claude/issues/addressed/0350__storage___asset-image-thumbnails__________LOW__.plan.md`. All SQL is in-place edits to existing
deploy files (no new sqitch changes — memory `sqitch-edit-in-place`); implementation phases live
in the plan's Suggested sequence.

**Detail page (2026-07-07) — asset detail at `/storage/assets/[id]` — IMPLEMENTED:**
the list shows **parent assets only** (correct); the detail page adds full metadata (uploader +
tenant, context/entity, tags; checksum row dropped), an image **preview**, a gallery of **derived
child assets** (thumbnails), an **easy deep-link to the processing `asset-scan` workflow** (via the
nullable `storage.asset.wf_id` captured at upload — path `queue_workflow(...).wf.id`), a
**Download**, and a **Delete** (confirmed) — soft-delete + MinIO object purge + child cascade, wired
as a **second REST carve-out** `DELETE /storage/api/assets/[id]` (own-tenant users + super-admin via
RLS on a SECURITY INVOKER gate; `storage_api` stays unexposed; a table-level `UPDATE` grant on
`storage.asset` was added since the INVOKER delete runs as the caller). Files: `asset-detail.ui.md`,
`asset-detail.data.md`; touches `_shared.data.md` (`wf_id`, `delete_asset`, `UPDATE` grant,
`downloadUrl` active-gate), `graphql.data.md` (`AssetDetail` query, `wfId` fragment field,
`useAssetDetail`), `endpoint.data.md` (`wf_id` capture + delete route), `components.ui.md` +
`assets-page.ui.md` (list name → base-relative detail link). Decisions locked with the user
2026-07-07 — see Q1 below. Implementation plan:
`.claude/issues/in-flight/0010__storage___asset-detail-page…plan.md` (staged §1 DB → §6 spec reconcile).

## Purpose

A tenant-scoped **asset** (uploaded file) capability. A user uploads a file; it is parsed and
validated, stored in **MinIO** (S3-compatible object storage) under a **`quarantine/` prefix**, and
recorded in the **`fnb-storage`** database module with `scan_status='pending'`. An **`asset-scan`
wf workflow** then scans the object with **ClamAV** and either **promotes** it to its final
`public|private` location (clean) or **purges** it (infected). Every asset is associated with an
owning entity via `context` + `owning_entity_id`, so assets can be queried per-entity (like `msg`
topics for todos).

Reads (list + download) are served through **PostGraphile GraphQL**, where a computed `downloadUrl`
field returns a short-lived **presigned** link (private) or direct unsigned URL (public) — **null
until the scan verdict is `clean`**. Upload is a REST endpoint (multipart can't ride GraphQL) served
by the new **`storage-app`**.

The first UI is the **assets page at `/storage/assets`** (in `storage-app`) — RLS-scoped, so
super-admins see every tenant's uploads and regular users see their own tenant's — built from
reusable `storage-layer` components that will later be embedded in todo / support-ticket detail
pages.

## Architecture revision 2026-07-06 (supersedes the v1 sync design)

Two decisions changed after the first spec round:

1. **Standalone app (msg pattern).** Upload endpoint and the asset UI live in
   **`packages/storage-layer`** (extends `fnb-tenant-layer` → inherits the claims middleware)
   served by a thin **`apps/storage-app`** (extends storage-layer; nginx `location /storage`).
   `graphql-api-app` keeps only the `downloadUrl` presign field (S3 creds for **signing only** — a
   local HMAC, no S3 round-trip). This decouples the GraphQL API from upload buffering and from
   ClamAV entirely. *(Revised by Plan D: the scan workflow handlers + worker plugin, originally in
   storage-layer, now live in `apps/worker-app` — see Status.)*
2. **Quarantine-first, always.** The old design scanned synchronously in the upload request and
   only quarantined in a future async phase. Now **all** uploads (public and private) land under
   `quarantine/…`, the row is inserted `pending`, and the `asset-scan` **wf workflow** (Option B —
   chosen over a bare graphile-worker task) scans and promotes/purges. Why: uniform pipeline (no
   public/private branch at upload), upload latency decoupled from clamd (slow first boot),
   retries/backoff free, observable in the existing Workflow Dashboard, and a natural place to add
   steps later (thumbnails, OCR, metadata). Upload returns **202 + `scanStatus: 'PENDING'`**.

Verified enablers (2026-07-06 exploration):
- `wf_fn.queue_workflow` enqueues graphile-worker jobs **from SQL** (`graphile_worker.add_job`), so
  `insert_asset` + `wf_api.queue_workflow('asset-scan', …)` in one transaction gives atomic
  row+job creation.
- A second graphile-worker instance (in storage-app) coexists safely with graphql-api-app's:
  shared default `graphile_worker` schema, workers only claim task identifiers in their own
  taskList — keep task names distinct. *(True but superseded by Plan D: both instances were
  consolidated into the single `apps/worker-app` runner, which also removes the fresh-DB
  schema-install race the two at-boot migrators created.)*
- msg-layer/msg-app is the exact structural precedent (layer owns pages/components/server;
  app is ~3 files); `fnb-create-app` scaffolds the app, compose service, and nginx block.
- Stale-code finding (flag, don't fix here): `_queueWorkflow.ts` in graphql-api-app references
  `prj_fn.do_queue_workflow`, which does not exist in `db/` — the live path is
  `wf_api.queue_workflow`.

## Corrections carried into this spec

- **`multer` is not used.** Express-only; the stack is Nitro/H3. Use `readMultipartFormData`.
- **`multer` does not scan malware.** Scanning is ClamAV (docker service + `clamscan` client).
- **Nothing is named bare `file`.** Schema `storage`, table `storage.asset`, GraphQL type `Asset`.

## Locked decisions

| # | Area | Choice |
|---|------|--------|
| — | App topology | **`packages/storage-layer` + `apps/storage-app`** (msg pattern); nginx `/storage`; graphql-api-app keeps presign only |
| — | Worker topology | **`apps/worker-app`** (Plan D, 2026-07-06) — headless compose service; the stack's ONLY graphile-worker migrator + runner; union taskList (wf generic + wf-exerciser + asset-scan); single `_workflow-handler` factory with a lazy `workerUtils` singleton; ClamAV env/gate lives here only |
| — | Object storage | MinIO (self-hosted S3-compatible), `@aws-sdk/client-s3` |
| — | Malware scan | ClamAV, **asynchronous via the `asset-scan` wf workflow** — quarantine-first for ALL uploads; scan → promote (clean) / purge (infected). Supersedes the v1 sync-scan design. |
| — | Pipeline mechanism | **wf workflow (Option B)** — `asset-scan` template via `wf_fn.upsert_wf`; handlers run in worker-app's graphile-worker runner (relocated from storage-app by Plan D) |
| — | DB module | `fnb-storage` → schemas `storage` / `storage_fn` / `storage_api`, table `storage.asset` (deployed) + new scan-resolution changes (see `_shared.data.md`) |
| — | Upload endpoint | `POST /storage/api/upload` (`packages/storage-layer/server/api/upload.post.ts`) — `event.context.claims` + raw `pg`: `insert_asset` + `queue_workflow` in one txn; responds **202 PENDING** |
| — | Insert semantics | **Insert-only** (`storage_api.insert_asset`); many assets per entity; duplicates allowed |
| — | Upload permission | `p:app-admin` OR `p:app-user` (`jwt.enforce_any_permission` — admin-only profiles can upload too) |
| — | Reads | GraphQL — `Asset` type exposed via PostGraphile; `downloadUrl` computed presigned field, **nullable — null unless `scan_status='clean'`** |
| — | Download | Presigned S3 GET with `ResponseContentDisposition` restoring the original filename; **15-min TTL**; public = direct unsigned URL |
| — | On-disk name | `[uuid].[extension]`; `original_name` kept in DB and restored on download |
| — | Storage key | quarantine: `quarantine/[tenant_id]/[context]/[entity]/[uuid].[ext]` → final: `[public\|private]/[tenant_id]/[context]/[entity]/[uuid].[ext]` (moved on clean verdict; `storage_key` updated) |
| — | Admin UI | **`/storage/assets`** page in storage-app (one RLS-scoped page: super-admin sees all tenants, users see own tenant). The `/tenant/site-admin/assets` page is **dropped**; the site-admin nav tool becomes a cross-app link (precedent: Workflow Dashboard → `/graphql-api/workflow`). |
| Q1 | Download/delete | Download live (GraphQL presign). **Delete implemented** (2026-07-07): soft-delete + object purge + child cascade via `DELETE /storage/api/assets/[id]` (REST carve-out — `storage_api` stays unexposed); own-tenant users + super-admin (RLS on a SECURITY INVOKER gate); confirmed in the UI. See `asset-detail.*` / `endpoint.data.md`. |
| Q2 | MinIO creds | Hardcoded dev defaults (overridable via `.env`); prod secret-sourcing out of scope |
| Q4 | GraphQL | **Reads exposed** — only the `storage` schema added to `graphile.config.ts` `schemas`. `storage_api`/`storage_fn` stay hidden — a **deliberate exception** to the exposed-`*_api` house pattern (a GraphQL `insertAsset` would let any user forge `scan_status`/`storage_key` rows). |
| Q5 | Cross-app POST | Same-origin (nginx `localhost:4000`); cookie flows automatically; no new CSRF — matches app posture |
| Q6 | Retention | Soft-delete modeled (`asset_status='deleted'`); no delete endpoint yet; infected assets are auto-soft-deleted by the workflow |
| Q7 | Duplicates | Allowed (insert-only) |

### Data model additions (vs. a plain file table)
- `storage.asset_context` enum = `('no_context', 'todo', 'support-ticket')`.
- `context` (enum), `owning_entity_id` (uuid, **nullable**, **no FK**, indexed — for later per-entity queries),
  `extension` (text) columns on `storage.asset`.
- `is_public` (boolean, default false, **immutable at upload**) — drives the final `public|private`
  storage path prefix, an anon-readable MinIO `public/*` policy, and the `downloadUrl` branch
  (public = direct unsigned URL, private = presigned). While `scan_status='pending'` the object is
  under `quarantine/` regardless of `is_public`.
- `scan_status` (`pending|clean|infected|error`) — `pending` is now the **normal initial state**;
  the workflow writes the terminal verdict.

### Public assets (decisions)
| # | Area | Choice |
|---|------|--------|
| P1 | Bucket strategy | One bucket `fnb-assets`; anon-download policy on the `public/*` prefix ONLY (never `quarantine/*`) |
| P2 | Publish rights | Any `p:app-user` may set `is_public` on their upload |
| P3 | Mutability | `is_public` immutable at upload (toggling would require moving the object) |
| P4 | Public enumeration | **Fetch-by-reference.** `anon` has no table grant (can't enumerate); reads public assets only via SECURITY DEFINER `storage.public_asset(id)` / `storage.public_assets_for_entity(context, owning_entity_id)` — both filter `is_public` **and `scan_status='clean'`**. See `_shared.data.md`. |

## Files in this spec

| File | Covers |
|------|--------|
| `_shared.data.md` | `fnb-storage` DB module — deployed schema + **new** scan-resolution/seeding changes, RLS, fnb-types |
| `infrastructure.md` | MinIO + ClamAV + **storage-app** docker services, nginx, env, healthchecks, bucket init, npm deps |
| `endpoint.data.md` | `POST /storage/api/upload` — parse → validate → store to quarantine → insert `pending` + queue workflow → 202 |
| `asset-scan-workflow.data.md` | The `asset-scan` wf workflow — template, handlers (scan/resolve), worker plugin, reaper |
| `graphql.data.md` | GraphQL exposure — `schemas` change, nullable `downloadUrl` presign plugin, hidden columns, queries, composables |
| `assets-page.ui.md` | The `/storage/assets` list page (storage-app) — parents only |
| `assets-page.data.md` | List page data — GraphQL list composable + REST upload composable |
| `asset-detail.ui.md` | **(implemented)** The `/storage/assets/[id]` detail page — full metadata, image preview, derived-children gallery, workflow deep-link, Download, Delete (confirmed) |
| `asset-detail.data.md` | **(implemented)** Detail page data — `AssetDetail` GraphQL query (asset-by-id + uploader/tenant + children) + `useAssetDelete` REST composable |
| `components.ui.md` | Reusable `AssetUploader` + `AssetList` components (in storage-layer) |

## Implementation Task List

Step-by-step build order. Each phase is independently verifiable before moving on.

### Phase 1 — DB module `fnb-storage` (`_shared.data.md`)  ✅ COMPLETE (deployed & verified 2026-07-03; re-verified vs. code 2026-07-06)
- [x] Sqitch package `db/fnb-storage/` — schema, enums, shadow tables, `storage.asset` + indexes,
      `asset_info` (with app-side `id`), `insert_asset`, `storage_api` gate, public read fns,
      grants + RLS. Registered in `DEPLOY_PACKAGES` and `db/db-config.ts`.

### Phase 2 — DB additions for the workflow (`_shared.data.md`)  ✅ COMPLETE (deployed 2026-07-06)
- [x] New sqitch change: `storage_fn.resolve_asset_scan(...)` (idempotent verdict writer:
      clean/infected/error + final `storage_key`) — `…10625`.
- [x] New sqitch change: `storage_fn.ensure_asset_scan_wf(_tenant_id)` (lazy per-tenant
      `wf_fn.upsert_wf` template seed) — `…10630`; adds sqitch dep `fnb-wf:00000000010520_wf_fn`.
- [x] Rework/additive change: `storage.public_asset*` fns add `and a.scan_status = 'clean'` — `…10635`.
- [x] `DEPLOY_PACKAGES`: `fnb-wf` (and its deps) deploy **before** `fnb-storage`.
- [x] Matching `revert/` + `verify/`; **no `git` during sqitch sessions**.

### Phase 3 — Infrastructure: MinIO + ClamAV (`infrastructure.md`)  ✅ COMPLETE (2026-07-06; revised by Plan D 2026-07-07)
- [x] `minio`, `minio-init` (bucket + `mc anonymous set download .../public` + quarantine `mc ilm`
      expiry), `clamav` services + `minio-data`/`clamav-db` volumes.
- [x] Env: `S3_*` (PutObject) → storage-app; full `S3_*` + `CLAMAV_*` + `ASSET_SCAN_*` →
      **worker-app** (Plan D); `S3_*` signing subset → graphql-api-app; keys mirrored to `.env.example`.
- [x] ClamAV gates **only** worker-app, and softly (`service_started` — scan jobs retry; never
      hard-gate on healthy).
- [x] Verified: bucket, `public/` anon policy, clamav.

### Phase 4 — Scaffold `storage-layer` + `storage-app` (`infrastructure.md`)  ✅ COMPLETE (2026-07-06)
- [x] `packages/storage-layer` — Nuxt layer, `extends: ['@function-bucket/fnb-tenant-layer']`
      (claims middleware inherited). `apps/storage-app` — thin app extending storage-layer.
- [x] nginx `location /storage` before the catch-all; compose service (msg-app template);
      named node_modules volume + pnpm-install mount; in nginx `depends_on`.
- [x] Deps: `@aws-sdk/client-s3`, `file-type`, `pg` (+ types) in storage-layer. (`clamscan` +
      `graphile-worker` ended up in **worker-app**, not storage-layer — Plan D.)

### Phase 5 — Upload endpoint (`endpoint.data.md`)  ✅ COMPLETE (2026-07-06)
- [x] `storage-layer/server/lib/s3.ts` + `asset-validation.ts`. (No `clam.ts` here — it lives in
      worker-app; no `build-jwt-claims.ts` — the txn reuses `withClaims` from `db-access`.)
- [x] `storage-layer/server/api/upload.post.ts` — auth (`p:app-admin`|`p:app-user` hint) → parse →
      validate (content-length **before buffering** + 411 on chunked, whitelist, magic-byte sniff)
      → checksum → PutObject to **quarantine key** → `withClaims` txn: `insert_asset` (`pending`) +
      `ensure_asset_scan_wf` + `wf_api.queue_workflow` → **202**.
- [x] Tested: clean upload (202 PENDING). Oversize (413) / wrong type (415) still open (Phase 11).

### Phase 6 — `asset-scan` workflow (`asset-scan-workflow.data.md`)  ✅ COMPLETE (2026-07-06; clean paths verified)
- [x] Template seed (`wf_fn.upsert_wf`, scan → resolve DAG) via `ensure_asset_scan_wf`.
- [x] Handlers `scan-asset`, `resolve-asset`, `asset-scan-completed` + the `_workflow-handler.ts`
      factory — built in storage-layer, **relocated by Plan D** to
      `apps/worker-app/server/lib/worker-task-handlers/`.
- [x] Worker plugin — built in storage-layer, **superseded by Plan D**: the single
      `apps/worker-app/server/plugins/graphile-worker.ts`.
- [x] Reaper for stuck-`pending` rows (two-phase + attempt cap — Plan A; runs in worker-app).
- [x] Tested: clean file promotes (`quarantine/` → `public|private/`, row updated) — private +
      public paths verified 2026-07-06.
- [ ] Remaining tests (Phase 11): EICAR purges (object deleted, `infected` + soft-deleted row);
      clamd down → retries then `error`.

### Phase 7 — GraphQL reads (`graphql.data.md`)  ✅ COMPLETE (2026-07-06)
- [x] Add **only** `'storage'` to `graphile.config.ts` `schemas` (never `storage_api`).
- [x] `postgraphile.tags.json5` — hide `storage_key` + `bucket` (behavior `-select -filterBy -orderBy`;
      the v5 names are `filterBy`/`orderBy`, not `filter`/`order`).
- [x] `downloadUrl` presign plugin — **nullable**, null unless `scan_status='clean'`; public = direct
      unsigned URL, private = presigned 15-min; registered in `preset.plugins`. **Gotchas fixed live:**
      `$asset.get()` uses snake_case column names; sign against the browser-reachable endpoint (§3).
- [x] Verified in GraphiQL: `storageKey`/`bucket` absent from type/condition/orderBy; no `insertAsset`
      mutation; anon `assetsList` errors (no enumeration); `publicAssetList` exclude non-clean.

### Phase 8 — types + GraphQL client + composables (`graphql.data.md`, `assets-page.data.md`)  ✅ COMPLETE (2026-07-06)
- [x] `Asset` (`downloadUrl: string | null`) + `AssetMeta` + enum unions (UPPERCASE) in
      `packages/fnb-types/src/asset.ts`; barrel-export.
- [x] `fragment/Asset.graphql` (all exposed fields) + list-form ops: `AllAssets` (`tenant { name }`),
      `AssetsByOwningEntity`, `PublicAsset` (`_id:`), `PublicAssetsForEntity` (`_context:`/`_owningEntityId:`).
- [x] Codegen; mapper `src/mappers/asset.ts` (`toAsset`); `useSiteAssets()`; barrel-export; rebuild.
- [x] `useAssetUpload()` (REST 202-aware) + `public.uploadUrl` runtimeConfig in storage-layer.

### Phase 9 — UI (`components.ui.md`, `assets-page.ui.md`)  ✅ COMPLETE (2026-07-06)
- [x] `storage-layer/app/components/AssetUploader.vue` (202/PENDING aware) + `AssetList.vue`
      (props-only; PENDING badge; download hidden when `downloadUrl === null`) + duplicated `PageHeader.vue`.
- [x] `storage-layer/app/pages/assets/index.vue` — hosts uploader (`NO_CONTEXT`) + list.
- [x] Verified end-to-end: upload → "scanning…" → Clean on refresh → download works (private + public).
      Also fixed a Phase-6 defect found here: storage-app worker crashed on the graphile-worker
      schema-install race on a fresh DB → added an idempotent-migrate retry in its plugin.

### Phase 10 — Nav (`assets-page.ui.md`)  ✅ COMPLETE (2026-07-06)
- [x] Cross-app tool `tenant-site-admin-asset-manager` ("Asset Manager", `i-lucide-grid-3x3`) →
      `/storage/assets`, gated `p:app-admin-super`, in `db/fnb-app/deploy/00000000010240_app_fn.sql`
      (`site-admin` module). Goes live on DB reseed (rebuild).

### Phase 11 — End-to-end verification
- [~] Partially verified 2026-07-06: clean private + clean public upload→scan→promote→download all
      pass; anon `publicAssetList` excludes non-clean; pending assets have null `downloadUrl`.
- [ ] Remaining: EICAR (infected → purge + soft-delete), oversize (413), wrong type (415), and the
      workflow visible in the Workflow Dashboard.

### Phase 12 — Asset detail page (`asset-detail.*`)  ✅ COMPLETE (implemented & staged 2026-07-07)
- [x] §1 DB: `storage.asset.wf_id`; `storage_api.delete_asset` (SECURITY INVOKER, soft-delete + child
      cascade); `grant update on storage.asset` (INVOKER delete runs as caller); revert/verify synced.
      Verified read-only post-rebuild (column present, `prosecdef=f`, UPDATE granted).
- [x] §2 types/GraphQL/codegen: `Asset.wfId`; fragment `wfId`; `AssetDetail` query; `toAsset` folds
      `wfId`; `useAssetDetail` composable + barrel export; inflected names verified via introspection
      (`asset(id:)`, `resident { displayName }`, `tenant { name }`); `pnpm build` green.
- [x] §3 REST: upload captures `wf_id` (`queue_workflow(...).wf.id`); `DELETE /storage/api/assets/[id]`
      (`useAssetDelete`, `messageForDeleteStatus`); delete cascade/RLS/permission verified in
      rolled-back txns (2 rows own-tenant, 0 cross-tenant, NOT AUTHORIZED without perm).
- [x] §4 presign gate: `downloadUrl` null when `asset_status != 'active'`.
- [x] §5 UI: `pages/assets/[id].vue` (metadata, preview, children gallery, workflow deep-link, delete
      modal); `AssetList` `linkDetail` + base-relative `#originalName-cell` link. `pnpm build` green.
- [x] §6 spec reconcile (this pass).
- [ ] User UI verification remaining: fresh upload sets `wf_id` + workflow deep-link resolves; live
      delete → `200 { deleted: n }` + MinIO objects purged + `downloadUrl` null + redirect to list.

## Remaining Open Questions

Not blockers; record answers as they resolve. The deferred v2 items + tests now have durable
plans under `.claude/issues/identified/`:
- Template ownership: lazy per-tenant `ensure_asset_scan_wf` (recommended, specced) vs anchor-only seed.
- Reaper cadence + `error`-state operator flow.
- ~~How tenant-app later consumes storage-layer components for todo/ticket embedding~~ —
  **resolved 2026-07-09 (issue 0330):** tenant-app `extends` `@function-bucket/fnb-storage-layer`
  (declared in its `package.json`, R24; compose service gains `NUXT_PUBLIC_UPLOAD_URL` — uploads
  still POST same-origin to `/storage/api/upload` via nginx). `useEntityAssets(context,
  owningEntityId)` implemented + barrel-exported; `AssetsByOwningEntity` gained the W3
  `assetStatus: ACTIVE` filter (split codified in `_shared.data.md`). Actually embedding the
  components in a page stays per-feature (todo: issue 0480, spec'd in
  `.claude/specs/tenant-app/tools/todo/[id].*`).
- ~~`_workflow-handler.ts` duplication~~ — resolved by Plan D: single copy in
  `apps/worker-app/server/lib/worker-task-handlers/`; extraction into a compiled package only if a
  second consumer ever appears.
- Real-time badge flip: manual/poll refresh for v1 → planned: `asset-scan-pg-notify-badge.plan.md`.
- Tenant-level nav for `p:app-user` (page currently URL-only for non-admins; also resolves W7) →
  planned: `asset-tenant-nav.plan.md`.
- Unit tests for `asset-validation.ts` / `toAsset` (final-eval M5) →
  planned: `asset-storage-unit-tests.plan.md`.
- Verify PostGraphile inflected names after codegen (see `graphql.data.md`).
- `i-lucide-*` icon names per-use check (UC11); storage-app must declare `@iconify-json/lucide`.

## Considered & rejected
- **`nuxt-file-storage`** module — local-filesystem only, base64 transfer, no object storage /
  presigned URLs / malware scan / DB. Wrong fit; sticking with MinIO.
- **Synchronous ClamAV scan in the upload request** (the original v1) — coupled upload latency and
  the API process to clamd; superseded by quarantine-first + workflow (2026-07-06).
- **Option A: bare graphile-worker `scan-asset` task** — lighter, but no dashboard observability
  and no natural home for future processing steps; wf workflow chosen instead.
- **Upload endpoint inside graphql-api-app** (the original v1) — superseded by storage-app so the
  GraphQL API doesn't buffer multipart bodies or depend on ClamAV/S3 writes.

### Resolved
- Icon for the assets nav tool → `i-lucide-folder` (verify exists).
- `no_context` path fallback → entity segment = asset uuid.
- Asset id generated **app-side** (deployed as `asset_info.id`; `coalesce(_info.id, gen_random_uuid())`).
- `UFileUpload` + `UEmpty` exist in installed `@nuxt/ui@4.6.1` (verified 2026-07-06).
- Assets page is **upload-capable** (allows `NO_CONTEXT` uploads) to verify end-to-end early.
- Spec dir renamed `file-upload/` → `asset-storage/`; page specs renamed
  `site-admin-assets.*` → `assets-page.*`; `async-scanning.future.md` → `asset-scan-workflow.data.md`.
