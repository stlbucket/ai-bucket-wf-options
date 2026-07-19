# Asset Upload — Endpoint Data Contract


> **URN stacking v2 (2026-07-10):** `storage.asset.context` (+ the `asset_context` enum) and
> `owning_entity_id` are **removed** — `subject_urn` is the only attach mechanism. Upload takes an
> optional `subjectUrn` form field (no `context`/`owningEntityId`); per-subject reads are
> `assetsBySubject` / `publicAssetsForSubjectList(_subjectUrn)` via `useSubjectAssets(subjectUrn)`;
> the quarantine key is `quarantine/{tenantId}/{subjectSeg}/{assetId}.{ext}`. Authoritative
> contract: `.claude/specs/urn-registry/stacking-v2.data.md`. `context`/`owning_entity_id`
> mentions below are historical.

## Status
**Implemented & verified 2026-07-06** (Phase 5; quarantine-first). The endpoint does not scan;
it stores to `quarantine/`, inserts a `pending` row, and queues the `asset-scan` wf workflow —
all responding **202 Accepted**. Live-run corrections folded back in: the record+queue
transaction uses **`withClaims(claims, fn)` from `db-access`** (not a hand-rolled
role/`set_config` block), and the permission gate is **`p:app-admin` OR `p:app-user`**
(`jwt.enforce_any_permission`).

**v2 (2026-07-06 spec / 2026-07-07 implemented) — image processing:** two new multipart fields,
`tags` (comma-delimited user tags → normalized → stored at insert) and `aiTagsRequested` (opt-in
AI-tagging flag → workflow input). **Implemented 2026-07-07** — `normalizeTags` + `IMAGE_TYPES` in
`asset-validation.ts`; insert gains the trailing `$14::citext[]` param; queue call passes
`aiTagsRequested`; `pnpm build` green. Sections marked **(v2 draft)**. Driven by
`.claude/issues/addressed/0350__storage___asset-image-thumbnails__________LOW__.plan.md`; shared rules (reserved tags,
`asset_info.tags`) in `_shared.data.md`.

**Detail additions (2026-07-07) — implemented:** the upload txn also captures the `asset-scan`
workflow **instance id** into `asset.wf_id` (deep-links the detail page), and a **second REST route
`DELETE /storage/api/assets/[id]`** (soft-delete + object purge + child cascade) backs the detail
page's Delete action. Contract: `asset-detail.data.md`; `storage_api.delete_asset` + `wf_id` in
`_shared.data.md`.

The upload endpoint lives in **`packages/storage-layer`** (H3 carve-out — multipart can't ride
GraphQL) and is served by **`storage-app`**. Reads (list + download) are GraphQL — see
`graphql.data.md`; scanning/promotion is the workflow — see `asset-scan-workflow.data.md`.
Authorization uses `event.context.claims`, populated by the **tenant-layer auth middleware**
(`applyEventClaims`) inherited through the extends chain storage-app → storage-layer →
tenant-layer (same mechanism verified for msg-app). DB access is `withClaims(claims, fn)` from
`db-access` (raw `pg` under the hood — the same 2-arg carve-out the msg WS read uses).

---

## Route

- **Method / path:** `POST /storage/api/upload` (nginx `location /storage` → storage-app)
- **Handler:** `packages/storage-layer/server/api/upload.post.ts`
- **Body:** `multipart/form-data` with:
  - `file` — the file part (single, ≤ 5 MB)
  - `context` — one of `NO_CONTEXT` | `TODO` | `SUPPORT_TICKET` (the fnb-types `AssetContext`
    vocabulary — the endpoint maps to the DB enum values `no_context`/`todo`/`support-ticket`
    internally, and back to UPPERCASE in the response)
  - `owningEntityId` — uuid (omit/empty when `context = NO_CONTEXT`)
  - `isPublic` — `'true'` | `'false'` (optional; default `false`). Any `p:app-user` may publish;
    immutable after upload. Note: the object still starts in `quarantine/` — `is_public` only
    determines the **final** prefix after a clean verdict.
  - **(v2 draft)** `tags` — optional comma-delimited string of user tags (any file type).
    Server-side normalization is authoritative (the UI pre-normalizes as a courtesy): split on
    `,`, trim, drop empties, dedupe case-insensitively (`citext`), cap **≤ 20 tags / ≤ 50 chars
    each** (400 over cap). **Reserved tags** `thumbnail` / `ai-tags-coming-soon` → 400 (users
    must not fake system state).
  - **(v2 draft)** `aiTagsRequested` — `'true'` | absent (like `isPublic`). Only valid when the
    file is an **image** type (`image/png|jpeg|webp|gif`): set on a non-image → 400 (the UI
    disables the checkbox for non-images, so this only arrives from hand-rolled requests —
    reject, don't silently drop). Travels as **workflow input**, not asset state; the visible
    v1 outcome is the `ai-tags-coming-soon` tag appended by the `ai-tag-asset` step.
- **Auth:** requires the `session` cookie → `claims.profileId` + `claims.tenantId`. DB enforces
  `p:app-admin` OR `p:app-user` (`jwt.enforce_any_permission` in `storage_api.insert_asset`).
- **Cross-origin:** same-origin via nginx (`localhost:4000`) — the `session` cookie flows
  automatically; no CORS, no CSRF token (Q5).

---

## Handler algorithm

```
export default defineEventHandler(async (event) => {
  1. AUTH — fast UI hint; the DB re-enforces via storage_api.insert_asset (keep the two in sync)
     const claims = event.context.claims
     if (!claims?.profileId) throw createError({ statusCode: 401 })
     if (!claims.permissions?.some(p => p === 'p:app-admin' || p === 'p:app-user'))
       throw createError({ statusCode: 403 })
     if (!claims.tenantId) throw createError({ statusCode: 403, statusMessage: 'No tenant' })

  2. PARSE (H3 built-in — no multer)
     const parts = await readMultipartFormData(event)
     const filePart = parts?.find(p => p.name === 'file' && p.filename)
     const context  = fieldValue(parts, 'context')          // fnb-types value; map → DB enum
     const owningEntityId = fieldValue(parts, 'owningEntityId') || null
     const isPublic = fieldValue(parts, 'isPublic') === 'true'
     const aiTagsRequested = fieldValue(parts, 'aiTagsRequested') === 'true'      // (v2 draft)
     const tags = normalizeTags(fieldValue(parts, 'tags'))                        // (v2 draft)
     //   normalizeTags: split ',' → trim → drop empties → dedupe (case-insens.) →
     //   400 if >20 tags / any >50 chars / any reserved ('thumbnail','ai-tags-coming-soon')
     if (!filePart) throw createError({ statusCode: 400, statusMessage: 'no file' })
     if (!ASSET_CONTEXTS.has(context)) throw createError({ statusCode: 400, statusMessage: 'bad context' })
     if (context !== 'NO_CONTEXT' && !isUuid(owningEntityId))
       throw createError({ statusCode: 400, statusMessage: 'owningEntityId required' })
     // (v2 draft — after step 3 resolves contentType): aiTagsRequested && !IMAGE_TYPES.has(contentType) → 400

  3. VALIDATE
     const buf = filePart.data
     if (buf.length > 5 * 1024 * 1024) throw createError({ statusCode: 413 })
     const contentType = filePart.type ?? 'application/octet-stream'
     if (!ALLOWED_TYPES.has(contentType)) throw createError({ statusCode: 415 })
     const extension = extForContentType(contentType, filePart.filename)  // validated, lowercased, no dot
     // magic-byte sniff (file-type) must agree with contentType — see Security hardening

  4. CHECKSUM
     const checksum = crypto.createHash('sha256').update(buf).digest('hex')

  5. COMPUTE QUARANTINE KEY + STORE (MinIO) — NO scan here (workflow scans)
     const assetId = crypto.randomUUID()
     const dbContext = toDbContext(context)                  // 'NO_CONTEXT' → 'no_context', …
     const entitySeg = dbContext === 'no_context' && !owningEntityId ? assetId : owningEntityId
     const storageKey = `quarantine/${claims.tenantId}/${dbContext}/${entitySeg}/${assetId}.${extension}`
     await s3.send(new PutObjectCommand({
       Bucket: process.env.S3_BUCKET, Key: storageKey,
       Body: buf, ContentType: contentType, ContentLength: buf.length,
     }))

  6. RECORD + QUEUE — ONE transaction via withClaims(claims, fn) from db-access
     //   (withClaims does begin; set local role authenticated; set_config('request.jwt.claims', …);
     //    fn(client); commit — same claims shape PostGraphile's grafast context uses)
     const row = await withClaims(claims, async (client) => {
       const inserted = await client.query(
         `select * from storage_api.insert_asset( ROW(assetId, ...)::storage_fn.asset_info )`)
         //  with scan_status='pending', storage_key=<quarantine key>, context, owning_entity_id,
         //       is_public, original_name, extension, content_type, size_bytes, bucket, checksum_sha256
         //  (v2 draft) + trailing $14::citext[] = the normalized user tags (asset_info.tags —
         //  lockstep with the trailing field added to storage_fn.asset_info, _shared.data.md)
       await client.query(`select storage_fn.ensure_asset_scan_wf($1::uuid)`, [claims.tenantId])   // lazy template seed
       const queued = await client.query(
         `select wf_api.queue_workflow('asset-scan'::citext,
            jsonb_build_object('assetId', $1::text, 'aiTagsRequested', $2::boolean))`,   // (v2 draft) 2nd input
         [assetId, aiTagsRequested])
         //  wf_fn.queue_workflow enqueues the graphile-worker job(s) IN SQL → atomic with the row
       // Capture the workflow INSTANCE id → asset.wf_id (deep-links the detail page).
       //   VERIFIED PATH (2026-07-07): wf_api.queue_workflow returns to_jsonb(queue_workflow_result)
       //   where the composite is (wf wf.wf, uows_to_schedule wf.uow[]) — so the instance id is at
       //   result.wf.id. With no column alias, node-pg exposes it under the `queue_workflow` column
       //   (jsonb auto-parses to a JS object). Null-safe: skip the update if no id resolves.
       const wfId = queued.rows[0]?.queue_workflow?.wf?.id ?? null
       if (wfId) await client.query(
         `update storage.asset set wf_id = $1::uuid where id = $2::uuid`, [wfId, assetId])
       return inserted.rows[0]!
     })
     // on failure: 500; the object is already in quarantine/ (orphaned; reaped by the mc ilm
     // lifecycle rule — infrastructure.md)

  7. RESPOND — 202 Accepted (AssetMeta — fnb-types; enum values mapped back to UPPERCASE)
     setResponseStatus(event, 202)
     return { id: row.id, context: toAssetContext(row.context), owningEntityId: row.owning_entity_id,
              isPublic: row.is_public, originalName: row.original_name, extension: row.extension,
              contentType: row.content_type, sizeBytes: Number(row.size_bytes),
              scanStatus: 'PENDING', tags: row.tags /* (v2 draft) */,
              createdAt: <row.created_at as ISO string> }
})
```

Ordering: store-then-record means the recorded `storage_key` always points at a real object. If
step 6 fails after step 5, the object is orphaned in `quarantine/` (acceptable; a lifecycle rule /
reaper reconciles — see `asset-scan-workflow.data.md`). The transactional SQL enqueue inside
`wf_fn.queue_workflow` (verified: it calls `graphile_worker.add_job` itself) means **no row without
a job and no job without a row** — the crash window between commit and enqueue that a JS
`addJob`-after-commit would have does not exist.

The endpoint generates `assetId` app-side so the storage key and DB row id match — deployed as
`asset_info.id` (`storage_fn.insert_asset` uses `coalesce(_info.id, gen_random_uuid())`).

### `request.jwt.claims` payload (reused shape)

`withClaims` (from `@function-bucket/fnb-db-access`) sets the **same** JSON shape PostGraphile
uses (the `grafast.context` hook in graphql-api-app's `server/graphile.config.ts` — `role`,
`email`, `display_name`, `user_metadata.{profile_id, tenant_id, resident_id, actual_resident_id,
permissions}`), so RLS + `jwt.*` behave identically on this carve-out. There is no layer-local
claims builder — the shape lives once, in `db-access` (the planned
`build-jwt-claims.ts` util was superseded by reusing `withClaims`).

### `ALLOWED_TYPES` (images + documents)

```
image/png, image/jpeg, image/webp, image/gif,
application/pdf,
application/vnd.openxmlformats-officedocument.wordprocessingml.document,   // .docx
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,         // .xlsx
text/csv, text/plain
```
`extForContentType` maps each to a canonical extension (`png`, `jpg`, `webp`, `gif`, `pdf`, `docx`,
`xlsx`, `csv`, `txt`) and cross-checks the uploaded filename's extension (defense in depth).

### Response codes

| Code | When |
|------|------|
| 202  | Stored to quarantine, recorded `pending`, workflow queued — returns `AssetMeta` (`scanStatus: 'PENDING'`) |
| 400  | No file / bad `context` / missing `owningEntityId` for a non-`NO_CONTEXT` upload / malformed multipart / **(v2 draft)** reserved or over-limit `tags` / `aiTagsRequested` on a non-image |
| 401  | No `session` cookie / no claims |
| 403  | Authenticated but lacks `p:app-admin`/`p:app-user`, or has no `tenantId` (UI hint; DB also enforces) |
| 411  | `Transfer-Encoding: chunked` (no content-length; never sent by browser FormData) |
| 413  | File > 5 MB |
| 415  | Content type not in whitelist (or magic-byte mismatch) |
| 500  | Storage or DB write failed |

There are **no scanner response codes** (the old 422/502) — the scan happens in the workflow after
the response. Scan outcomes surface through the asset's `scanStatus` on subsequent reads.

---

## Delete route (implemented — `DELETE /storage/api/assets/[id]`)

Implemented (2026-07-07). The second (and only other) REST carve-out — a **soft-delete +
object purge** driving the detail page's Delete action (`asset-detail.*`). REST for the same reasons
as upload: it does side-effecting **object writes** (MinIO `DeleteObject`), and `storage_api` is
deliberately unexposed from GraphQL (`graphql.data.md` §1), so it can't be a mutation.

- **Method / path:** `DELETE /storage/api/assets/[id]` (nginx `location /storage` → storage-app)
- **Handler:** `packages/storage-layer/server/api/assets/[id].delete.ts`
- **Auth:** `event.context.claims` — UI hint `p:app-admin` OR `p:app-user`; the DB re-enforces via
  `storage_api.delete_asset` (base check) **+ RLS** (tenant scoping). Keep the hint in sync.

> **DB grant (implementation note, 2026-07-07).** `storage_api.delete_asset` is **SECURITY INVOKER**
> and runs its `UPDATE` **as the caller** (`authenticated`) so RLS scopes the rows. That means the
> caller needs a table-level `UPDATE` privilege on `storage.asset` — previously only `SELECT` was
> granted, so `grant update on storage.asset to authenticated, service_role` was added to
> `00000000010620_storage_policies.sql`. RLS still confines which rows can be touched; there is no
> direct-SQL mutation surface (default mutations disabled, `storage_api` unexposed). See
> `_shared.data.md`.
- **Algorithm:**
  ```
  1. AUTH — same claims check as upload (401 no claims; 403 lacks p:app-admin/p:app-user or no tenantId)
  2. const id = getRouterParam(event, 'id'); if (!isUuid(id)) throw createError({ statusCode: 400 })
  3. DELETE (soft) + collect objects — ONE withClaims(claims, fn) transaction:
       const rows = (await client.query(
         `select * from storage_api.delete_asset($1::uuid)`, [id])).rows
       //  SECURITY INVOKER + RLS: rows = the asset + its derived children the caller may touch.
       //  Empty ⇒ not visible under RLS / already deleted.
     if (rows.length === 0) throw createError({ statusCode: 404, statusMessage: 'not found' })
  4. PURGE OBJECTS — best-effort, AFTER the txn commits (don't purge then roll back):
       await Promise.allSettled(rows.map(r =>
         s3.send(new DeleteObjectCommand({ Bucket: r.bucket, Key: r.storage_key }))))
       //  log rejections; a stranded promoted object is an accepted small risk (recorded).
  5. RESPOND — 200 { deleted: rows.length }
  ```
- **Response codes:** `200 { deleted: n }` · `400` bad id · `401` no claims · `403` lacks
  permission / no tenant · `404` nothing matched under RLS (not yours / not found / already
  deleted) · `500` DB failure.
- **Ordering:** soft-delete-then-purge (mark in DB first, delete objects after commit) means the
  row is authoritative even if an object delete fails; the reverse could purge an object then roll
  back the row. Object-delete failures are logged, not fatal (the row is already `deleted` and its
  `downloadUrl` is null — `graphql.data.md` §3).
- **Cascade:** `storage_api.delete_asset` already includes `parent_asset_id = _id` rows, so the
  derived thumbnail is soft-deleted and its object purged in the same call — no separate child
  handling in the endpoint.
- **Idempotent:** re-deleting matches 0 active rows → 404; safe to retry.

## Security hardening

- **Enforce max body size BEFORE buffering (important).** `readMultipartFormData` buffers the entire
  request body into memory before step 3's `buf.length` check runs — so a malicious 2 GB upload OOMs
  the process before we ever reject it. Cap the request body at the Nitro layer (route rule /
  `getRequestHeader('content-length')` pre-check, or a streaming size guard) so the 5 MB limit is
  enforced at ingest, not after the buffer already exists. The step-3 check stays as a backstop.
  Chunked bodies (no content-length) are rejected outright with **411** — browsers always send
  content-length for FormData, so only hand-crafted clients are affected.
- **Sniff magic bytes, don't trust the client MIME.** `filePart.type` and the filename extension are
  both client-controlled. ClamAV catches known malware but not a `.png` that is actually HTML/SVG with
  script, or a mislabeled type. Verify the real type from the file's magic bytes (e.g. `file-type`)
  and require it to match the declared `content_type`/extension whitelist. (SVG is already excluded —
  keep it out; it can carry XSS.)
- **Unscanned bytes are never reachable.** The `quarantine/` prefix has no anon policy and
  `downloadUrl` is null while `pending` — see `asset-scan-workflow.data.md` / `graphql.data.md`.

## Notes / constraints

- **Nitro body size:** confirm the default accepts a 5 MB body; raise/lower the limit via route rule
  / Nitro option (also serves the hardening note above). Resolved — see Open Questions.
- **In-memory buffering** at 5 MB is fine. A larger future cap would need streaming parse→upload.
- **nginx body cap:** `client_max_body_size 6m` in the `/storage` location (`docker/nginx.conf`) —
  5 MB file + 1 MB multipart headroom, matching `MAX_BODY_BYTES`. nginx defaults to 1m; without
  this, legitimate uploads 413 at the proxy and never reach the endpoint.
- **pg Pool:** DB access rides `withClaims` → `db-access`'s own module-level pool. storage-layer
  creates no pool of its own.
- **No REST list route** — listing is GraphQL (`graphql.data.md`). Only **upload** and **delete**
  are REST — both are side-effecting object writes that can't ride GraphQL.
- **Stale-code note (repo-wide, don't copy):** graphql-api-app's `_queueWorkflow.ts` references
  `prj_fn.do_queue_workflow`, which does not exist in `db/`. The live queue path — used here — is
  `wf_api.queue_workflow`.

## Open Questions (endpoint)
- [x] App-side vs DB-side asset id generation — **resolved: app-side** (`asset_info.id` is deployed).
- [x] Nitro max body size confirmation for 5 MB — **resolved (2026-07-07):** no Nitro default cap
  exists; enforced by the content-length pre-check + 411 on chunked bodies in the handler, plus
  `client_max_body_size 6m` at nginx.
- [x] `no_context` path fallback (entity segment = asset uuid) — confirmed (README "Resolved").
- [x] Sync scan in the request — **superseded** by quarantine-first + workflow (2026-07-06).
