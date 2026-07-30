# Plan: Image processing in the asset-scan workflow — ffmpeg thumbnails + AI-tag stub (asset-storage v2)

> **Execution Directive:** Spec first, then implement — this is a non-trivial feature.
> Invoke: `/fnb-stack-spec <this-file>` to author
> the spec (update `.claude/specs/asset-storage/asset-scan-workflow.data.md`, `_shared.data.md`,
> `endpoint.data.md`, `components.ui.md`, `graphql.data.md`), then `/fnb-stack-implementor`
> against the resulting spec.
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify
> read-only. Never run `git` during any sqitch session.
>
> **Spec round is complete** (2026-07-06/07): all files in §7 carry `(v2 draft)` sections and the
> Open Questions below are resolved. Ready for the implementor.
>
> **IMPLEMENTED 2026-07-07** — §1–§7 complete via `/fnb-stack-implementor`; full `pnpm build` green
> (12/12). Env rebuilt (ffmpeg live, DB reseeded with the 4-uow template, codegen re-run). §7 spec
> Status blocks flipped to implemented. Remaining: live end-to-end verification (plan §Verification
> 1–9) after `docker compose restart graphql-api-app storage-app`. Plan stays in `identified/`
> pending that verification + user sign-off (do not move to `addressed/` without asking).
>
> **Implementor invocation** — drive from this plan (sequence + constraints), read the full spec
> tree for the contract:
>
> ```
> /fnb-stack-implementor Implement <this-file>.
> Read the full asset-storage spec tree first: .claude/specs/asset-storage/_shared.data.md,
> endpoint.data.md, asset-scan-workflow.data.md, graphql.data.md, components.ui.md,
> infrastructure.md, assets-page.data.md, assets-page.ui.md — plus .claude/specs/global-rules.md
> and .claude/specs/graphql-api-pattern.md.
> Follow the plan's Suggested sequence (§1–7) IN STAGES: complete one numbered section, stop, and
> report before starting the next. Do NOT run the whole sequence straight through.
> Honor the Execution Directive: all SQL is in-place edits to existing deploy files (no new sqitch
> changes this phase), pnpm build is the gate, never run git, and never rebuild/restart Docker
> yourself — stop and ask, then verify read-only.
> ```
>
> **Stage boundaries (stop + report after each):** §1 DB → §2 Docker *(user rebuild: ffmpeg
> image)* → §3 Worker → §4 Endpoint → §5 Uploader UI *(user `docker compose restart storage-app`)*
> → §6 Types/GraphQL ripple *(codegen + package rebuild)* → §7 spec reconcile. The §2 and §5 stops
> are mandatory — they need a user-run rebuild/restart before the next stage can be verified.
> **Preflight:** confirm the uncommitted in-place edit adding `tags citext[]` + `parent_asset_id`
> to `db/fnb-storage/deploy/00000000010600_storage.sql` is present before starting §1.

**Severity: MEDIUM (v2 feature)** · Workstream: asset-storage · Identified: 2026-07-06 · Revised: 2026-07-06 (ffmpeg + AI-tag stub + staged uploader)

## Goal

Three connected additions to the asset pipeline:

1. **Thumbnails.** When an uploaded asset is an image, generate a thumbnail **after** the scan
   verdict is `clean` and the object has been promoted to its resting place (`public/…` or
   `private/…`). The thumbnail is written directly to the final prefix (never quarantine — its
   bytes are derived by trusted code from an already-scanned-clean object) and gets its **own
   `storage.asset` row** with:
   - `parent_asset_id` = the original image's asset id
   - `tags` = `{'thumbnail'}`
   - `scan_status = 'clean'` (born clean; it is never scanned)
   - tenant/resident/context/owning_entity/is_public **inherited from the parent**
2. **AI tagging (stubbed).** At the uploader's request (opt-in checkbox), a workflow step will
   eventually feed the image to AI to generate descriptive tags. **v1 does not call any AI**: the
   step only appends the tag `'ai-tags-coming-soon'` to the *original* asset when the user
   requested it. The step exists now so the DAG shape, the request plumbing, and the tag surface
   are all in place when the real integration lands.
3. **User-supplied tags at upload.** The uploader can enter tags as a comma-delimited string;
   they are split/normalized and stored in the asset row's `tags` at insert (any file type, not
   just images). System-reserved tags (`thumbnail`, `ai-tags-coming-soon`) cannot be supplied by
   the user.
4. **Staged uploader UI.** `AssetUploader.vue` currently uploads the instant a file is selected
   (a `watch` on the file ref) — there is no moment to set options per-file. Rework it into a
   staged flow: select file → options (existing "Make public" switch, new **Tags** text input
   [comma-delimited, any file type], new "Generate AI tags" checkbox **enabled only when the
   selected file is an image type**) → explicit **Upload** button.

The `tags citext[]` and `parent_asset_id` columns are already added to `storage.asset`
(uncommitted in-place edit to `db/fnb-storage/deploy/00000000010600_storage.sql`); this plan
builds on that edit.

## Tooling decision: ffmpeg in a dedicated worker image (decided 2026-07-06)

**ffmpeg it is** — the user anticipates video assets (poster frames, transcodes) down the line, so
we take the system-binary cost now rather than adopting sharp and migrating later.

- **New `apps/worker-app/Dockerfile`** — worker-app currently builds from the shared
  `apps/auth-app/Dockerfile`; it gets its own:
  ```dockerfile
  FROM node:22-alpine
  RUN apk add --no-cache ffmpeg
  RUN corepack enable && corepack prepare pnpm@10.17.0 --activate
  WORKDIR /app
  EXPOSE 3000
  ```
  `docker-compose.yml` → `worker-app.build.dockerfile: apps/worker-app/Dockerfile`. Only the
  worker image carries ffmpeg; the routed apps keep the shared slim image.
- **Invocation:** shell out via `child_process` (`spawn`, not `exec` — binary stdout) with
  pipes, no temp files: bytes from S3 `GetObject` → stdin, thumbnail webp ← stdout. Sketch
  (final args are a spec decision):
  ```
  ffmpeg -hide_banner -loglevel error -i pipe:0 \
    -frames:v 1 -vf "scale='min(256,iw)':'min(256,ih)':force_original_aspect_ratio=decrease" \
    -f webp pipe:1
  ```
  `-frames:v 1` takes the first frame of animated GIFs; png/jpeg/webp/gif all pipe cleanly
  (single-image demuxers don't need seekable input — if a future video container does, fall back
  to a temp file *inside the container's* tmpdir). Capture stderr into the thrown error for the
  Workflow Dashboard. No npm dependency is added; a small `server/lib/ffmpeg.ts` wrapper
  (spawn + buffer collection + non-zero-exit → throw) keeps handlers clean.
- Covered input set matches `ALLOWED_TYPES` images exactly: `image/png`, `image/jpeg`,
  `image/webp`, `image/gif`. SVG is not an allowed upload type, so no rasterization concern.
- Dev-env note: the image change means a user-run rebuild (**ask the user**;
  `docker compose down && docker compose up --build worker-app` at minimum — and per
  `project_rebuild_wipes_db` a full rebuild wipes/reseeds the DB, which conveniently re-seeds the
  wf template below, so no template migration is needed in dev).

## Workflow design: two new uows in the existing DAG

Extend the `asset-scan` template (seeded by `storage_fn.ensure_asset_scan_wf`) from
`scan → resolve` to a diamond — the two processing steps are independent and run in parallel,
both gated on the promoted object:

```
scan-asset ──▶ resolve-asset ──▶ thumbnail-asset
                             └─▶ ai-tag-asset
```

- New uows `thumbnail-asset` and `ai-tag-asset` (`use_worker = true`), dependencies
  `('thumbnail-asset','resolve-asset')` + `('ai-tag-asset','resolve-asset')`. This is exactly the
  extension point the spec reserved ("thumbnailing, OCR, metadata extraction are future uows in
  the same DAG"). Task identifiers must stay unique across the union taskList.
- **Conditionality lives in the handlers, not the DAG** (house pattern — the engine is
  dependency-ordered, not branched). Each step short-circuits complete-with-note when its
  preconditions don't hold (see Handlers below).
- **New workflow input** `aiTagsRequested` (`'boolean'::wf.workflow_input_data_type`, default
  `'false'`, not required) alongside `assetId`. The upload endpoint passes it into
  `wf_api.queue_workflow('asset-scan', jsonb_build_object('assetId', …, 'aiTagsRequested', …))`;
  `ai-tag-asset` reads it from `workflowData.workflowInputData`.
- `asset-scan-completed` (on-completed) now fires after both processing uows — unchanged, still
  logs.

**Failure semantics (decide in spec, recommendation follows):** the reaper only watches
`scan_status='pending'` assets, so once `resolve-asset` lands the `clean` verdict, an errored
processing uow is **not** re-queued by anything — thumbnails and AI tags are best-effort.
Recommend: short in-handler retry/backoff for transient S3/DB blips (mirroring `scan-asset`'s
pattern, fewer attempts), then **throw** on exhaustion so the workflow shows an error resolution
in the Workflow Dashboard. The original asset is unaffected (already `clean`). A reaper extension
for missing thumbnails/tags is a v-next item, not v1.

**Defensive hardening while in `resolve-asset`:** if a resolved asset's workflow is ever re-run,
the `clean` branch computes `finalKey === storage_key` (the `quarantine/` prefix-replace no-ops)
and issues an S3 self-copy, which MinIO rejects. Add a guard: skip the Copy+Delete when
`storage_key` no longer starts with `quarantine/` (the DB call is already idempotent).

## Suggested sequence

### 1. DB (sqitch — `db/fnb-storage/`)

1. `00000000010600_storage.sql` (already modified in place): add supporting indexes alongside the
   new columns — `create index idx_asset_parent_asset_id on storage.asset (parent_asset_id) where
   parent_asset_id is not null;` (child lookups + the idempotency guard).
2. `00000000010625_storage_resolve_asset_scan.sql` (**edit in place — no new sqitch files right
   now**; this is the existing worker-only-functions file, and it must stay the home for these
   because it deploys *after* `00000000010620_storage_policies.sql`'s blanket
   `grant execute on all routines in schema storage_fn to authenticated` — the worker-only
   revokes only stick in a later file). Add two functions alongside `resolve_asset_scan`:
   - `storage_fn.insert_derived_asset(_parent_asset_id uuid, _id uuid, _storage_key text,
     _extension text, _content_type text, _size_bytes bigint, _checksum_sha256 text,
     _tags citext[]) returns storage.asset` — SECURITY DEFINER; loads the parent row (raise if
     missing), inherits `tenant_id, resident_id, context, owning_entity_id, is_public, bucket,
     original_name`; inserts with `scan_status='clean'`, `asset_status='active'`,
     `parent_asset_id`, `_tags`. Idempotency: if a child with `'thumbnail' = any(tags)` already
     exists for the parent, return it (no duplicate).
   - `storage_fn.add_asset_tags(_asset_id uuid, _tags citext[]) returns storage.asset` —
     SECURITY DEFINER; set-union append (no duplicate tags on re-run), bumps `updated_at`.
   - Both: `revoke all … from public, authenticated; grant execute … to service_role;` —
     worker-only, no `storage_api` wrappers.
3. `00000000010608_storage_fn_types.sql` + `00000000010610_storage_fn.sql` (edit in place):
   user tags land at insert, so `storage_fn.asset_info` gains a **trailing** `tags citext[]`
   field and `storage_fn.insert_asset` inserts `coalesce(_info.tags, '{}'::citext[])`. The
   trailing position keeps the endpoint's positional `row(...)::storage_fn.asset_info` cast a
   one-param addition (`$14::citext[]` — lockstep edit in `upload.post.ts`, step 11).
   `parent_asset_id` stays **out** of `asset_info` — the endpoint never sets it; only
   `insert_derived_asset` writes it, directly.
4. `00000000010630_storage_ensure_asset_scan_wf.sql` (edit in place, same convention as the
   column edit — dev rebuild re-seeds): add the two `wf_fn.uow_info` rows, the two dependency
   rows, and the `aiTagsRequested` input definition
   (`row('aiTagsRequested'::citext, 'boolean'::wf.workflow_input_data_type, 'false'::citext,
   false)`); update the template description. Note for a deployed env (none yet):
   `ensure_asset_scan_wf` is seed-once per tenant, so already-seeded tenants would keep the 2-uow
   template — dev's wipe-on-rebuild sidesteps this; record it as a known gap in the spec.

### 2. Docker

5. New `apps/worker-app/Dockerfile` (alpine + ffmpeg, above); point
   `worker-app.build.dockerfile` at it in `docker-compose.yml`. **User runs the rebuild.**

### 3. Worker (`apps/worker-app/`)

6. `server/lib/ffmpeg.ts` — `thumbnailWebp(input: Buffer, maxPx: number): Promise<Buffer>`:
   `spawn('ffmpeg', […])`, write input to stdin, collect stdout, reject with captured stderr on
   non-zero exit.
7. New handler `server/lib/worker-task-handlers/thumbnail-asset.ts` (wrapped by
   `_workflowHandler`):
   - `assetId` from `workflowData.workflowInputData`; load
     `bucket, storage_key, content_type, scan_status` via `useFnbPgClient()`.
   - Short-circuit complete (with a `note` in `stepData`) when: not `clean`; `content_type` not in
     the image set; thumbnail child already exists (`parent_asset_id = $1 and 'thumbnail' =
     any(tags)`).
   - `GetObject` the promoted object → `thumbnailWebp(buf, 256)` → compute the child key **in the
     parent's final directory**: `<public|private>/<tenant>/<context>/<entity>/<thumbId>.webp`
     (reuse the parent key's dirname; generate `thumbId` app-side so row id and key match, like
     the upload endpoint) → `PutObject` (ContentType `image/webp`) → sha256 checksum →
     `storage_fn.insert_derived_asset(parentId, thumbId, key, 'webp', 'image/webp', bytes,
     checksum, array['thumbnail'])`.
   - Transient-retry then throw, per Failure semantics above.
8. New handler `server/lib/worker-task-handlers/ai-tag-asset.ts` (wrapped by `_workflowHandler`):
   - Read `assetId` + `aiTagsRequested` from `workflowData.workflowInputData`.
   - Short-circuit complete-with-note when: not requested; asset not `clean`; not an image.
   - v1 stub: `storage_fn.add_asset_tags(assetId, array['ai-tags-coming-soon'])` — **no AI
     call**. Leave a `// v2: replace with real AI tagging` marker; the real integration swaps this
     one call and removes the placeholder tag.
9. Register `'thumbnail-asset'` and `'ai-tag-asset'` in `worker-task-handlers/index.ts`.
10. `resolve-asset.ts`: add the skip-S3-when-already-promoted guard (hardening above).

### 4. Upload endpoint (`packages/storage-layer/server/api/upload.post.ts`)

11. Parse two new multipart fields:
    - `aiTagsRequested` (`'true'`/absent, like `isPublic`). Validate: if set and `content_type`
      is not in the image set → `400` (the checkbox is disabled for non-images, so a non-image +
      flag is a hand-rolled request — reject, don't silently drop).
    - `tags` — comma-delimited string. Normalize server-side (authoritative; the UI is a hint):
      split on `,`, trim, drop empties, dedupe case-insensitively (they're `citext`), cap count +
      per-tag length (spec decision; suggest ≤ 20 tags, ≤ 50 chars). **Reject reserved tags**
      (`thumbnail`, `ai-tags-coming-soon`) with `400` — users must not be able to fake system
      state.
12. Thread both through the existing `withClaims` transaction:
    - the insert's positional cast gains the trailing tags param —
      `row($1, …, $13, $14::citext[])::storage_fn.asset_info` (lockstep with the `asset_info`
      change, DB step 3);
    - the queue call becomes `wf_api.queue_workflow('asset-scan',
      jsonb_build_object('assetId', $1::text, 'aiTagsRequested', $2::boolean))` — the AI flag is
      workflow input, not asset state; user tags are asset state, not workflow input.

### 5. Uploader UI (`packages/storage-layer/app/`)

13. `composables/useAssetUpload.ts` — `upload(...)` gains `aiTagsRequested = false` and
    `tags: string[] = []` params; append `form.append('aiTagsRequested', 'true')` when set and
    `form.append('tags', tags.join(','))` when non-empty.
14. `components/AssetUploader.vue` — restructure from upload-on-select to a staged flow:
    - `UFileUpload` selects but **no longer triggers upload** (drop the `watch`-fires-upload).
    - Once a file is staged, show: filename (+ clear/`x` button), the existing "Make public"
      `USwitch`, a **Tags** `UInput` (placeholder e.g. "Tags, comma-separated" — any file type;
      client-side split/trim/dedupe before calling `upload`, mirroring the endpoint rules), a
      new "Generate AI tags" `UCheckbox` — `:disabled` unless `file.type` is in the image
      whitelist (mirror the endpoint's image set; also reset it to unchecked when a non-image is
      selected) — and an explicit **Upload** `UButton` (loading state = `uploading`).
    - Existing behavior retained: toast on 202 ("Upload accepted — scanning…"), `uploaded` emit,
      reset the staged file + fields after success/failure so the same file can be re-selected.
    - Layer changes hot-reload note: `packages/*-layer` edits need
      `docker compose restart storage-app` (`project_layer_changes_need_restart`) — ask the user.
15. UC rules apply (UC6 color tokens, UC7 toasts, UC11 verify any new `i-lucide-*` icon exists).
    R2 exception stands: AssetUploader owns its POST (documented carve-out, like `Msg.vue`).

### 6. Types / GraphQL / UI ripple (new columns are now API-visible)

16. `packages/fnb-types/src/asset.ts`: `Asset` gains `tags: string[]` and
    `parentAssetId: string | null`; `AssetMeta` (the 202 response shape) gains `tags: string[]`
    and the endpoint returns the inserted row's tags.
17. `packages/graphql-client-api/src/graphql/storage/fragment/Asset.graphql`: add `tags`,
    `parentAssetId` (fragments select **every** field — `feedback_fragments_all_fields`); run
    codegen; update the `toAsset` mapper (un-Maybe the array, `?? []`).
18. Assets page (`useSiteAssets` / `AssetList`): **spec decisions** —
    - thumbnails are `clean`, so without a filter they appear as rows in `/storage/assets`;
      recommend filtering the list to `parentAssetId is null` (condition in the query) for v1.
      *Rendering* the thumbnail in the list (swap the icon for the child's `downloadUrl`) is the
      natural v2 follow-on.
    - surface `tags` in the list (a `UBadge` per tag is the obvious rendering) — shows both
      user-supplied tags and `ai-tags-coming-soon` (v1's only user-visible proof the AI request
      took).

### 7. Specs to update (during `/fnb-stack-spec`)

- `asset-scan-workflow.data.md` — DAG becomes 4 uows (diamond); `aiTagsRequested` input; failure
  semantics; template edit note; ffmpeg-in-worker-image decision (supersedes any sharp mention).
- `_shared.data.md` — new columns + indexes, `insert_derived_asset`, `add_asset_tags`, born-clean
  rule for derived assets, reserved tags (`thumbnail`, `ai-tags-coming-soon`).
- `endpoint.data.md` — `aiTagsRequested` + `tags` multipart fields, normalization + reserved-tag
  400 rules, `asset_info` trailing `tags` field.
- `components.ui.md` — staged AssetUploader flow (tags input + AI checkbox + Upload button).
- `graphql.data.md` — fragment/type additions; list filter decision.
- `infrastructure.md` — worker-app's dedicated Dockerfile (ffmpeg).

## Open questions — RESOLVED in the spec round (2026-07-06, `/fnb-stack-spec`)

- [x] Thumbnail geometry + format — **256 px max dimension, aspect-preserving, never enlarge,
      webp** (user-confirmed). Pinned ffmpeg args in `asset-scan-workflow.data.md` → Image tooling.
- [x] Exact ffmpeg arguments — pinned in `asset-scan-workflow.data.md` (scale + `-frames:v 1` +
      `-f webp` via pipes).
- [x] `original_name` for the child row — inherit the parent's verbatim.
- [x] User-tag limits — ≤ 20 tags, ≤ 50 chars each, trim + case-insensitive dedupe only.
- [x] Thumbnail child does **not** inherit the parent's user tags — carries `{'thumbnail'}` only.
- [x] Child assets hidden from **all** lists (user-confirmed): `AllAssets` /
      `AssetsByOwningEntity` condition `parentAssetId: null`; `public_assets_for_entity` gains
      `and a.parent_asset_id is null`; `public_asset(_id)` by-reference unchanged.
- [x] Processing-failure visibility — **dashboard-only best-effort** (user-confirmed): in-handler
      transient retries then throw; no reaper extension in v1.
- [x] AI-tag stub on non-request — short-circuit complete-with-note only.
- [x] Checkbox copy — **"Generate AI tags"** with help text **"Coming soon — your request will be
      noted on the asset."** (user-confirmed).
- [ ] Deployed-env template migration for seed-once `ensure_asset_scan_wf` — recorded as a known
      gap in `asset-scan-workflow.data.md`; moot in dev (rebuild re-seeds), not an implementation
      blocker.

## Verification (read-only after the user rebuilds)

1. `pnpm build` green; `docker compose exec worker-app ffmpeg -version` works.
2. Upload a PNG/JPEG (private, checkbox off): badge flips to Clean; MinIO shows
   `private/<tenant>/…/<thumbId>.webp` next to the promoted original; `storage.asset` has a child
   row with `parent_asset_id` set, `tags = {thumbnail}`, `scan_status = 'clean'`; original row's
   tags unchanged; Workflow Dashboard shows the 4-uow `asset-scan` run completed.
3. Upload an image with "Generate AI tags" checked and tags `foo, Bar`: original asset's `tags`
   contains `foo`, `bar`, and `ai-tags-coming-soon` (visible as badges in the assets list);
   thumbnail child also created with `tags = {thumbnail}` only.
4. Hand-rolled `curl` with `tags=thumbnail` (reserved) → `400`; duplicate/whitespace tags
   (`a, a , B,b`) collapse to `{a,b}`.
5. Upload a public image: thumbnail lands under `public/…` and its `downloadUrl` resolves
   anonymously.
6. Select a **PDF** in the uploader: AI-tags checkbox is disabled but the tags input works;
   upload completes with user tags on the row; both processing steps show not-an-image no-op
   notes; no child row, no AI tag.
7. Hand-rolled `curl` with `aiTagsRequested=true` + a PDF → `400`.
8. EICAR: infected purge path unchanged; neither processing step does work (verdict guard).
9. Re-run safety: re-enqueue either processing uow for an already-processed asset — handlers
   short-circuit; no duplicate child row, no duplicate tag.
