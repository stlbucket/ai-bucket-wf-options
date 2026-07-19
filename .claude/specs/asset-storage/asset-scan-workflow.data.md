# Asset Scan — wf Workflow (v1 + v2 image-processing draft)

> **SUPERSEDED 2026-07-17** by
> `.claude/specs/agentic-workflow-engine/asset-scan.workflow.data.md` — the wf engine and
> worker-app are retired (R22); the asset-scan pipeline now runs as an agentic workflow in
> `apps/agent-app` (atomic `scan_and_resolve` tool + agent-orchestrated thumbnail/tag branches +
> deterministic croner reaper). The **contract** below (quarantine-first, one terminal verdict,
> idempotent re-runs, reads gated on clean, no stranded assets) is inherited unchanged; the
> execution shape described in this file is historical.

## Status
**Implemented 2026-07-06** (Phase 6 + Plans A/D); clean private/public paths verified end-to-end.
Remaining verification: EICAR purge + clamd-down → `error` (README Phase 11). Formerly
`async-scanning.future.md` (a provisional Phase-2 sketch); the quarantine-first pipeline is the
launch design, and **Option B (wf workflow)** is locked — Option A (bare graphile-worker task) is
recorded under Considered & rejected.

**v2 (2026-07-06 spec / 2026-07-07 implemented) — image processing:** the DAG grew from
`scan → resolve` to a diamond with two parallel post-resolve steps — `thumbnail-asset` (ffmpeg →
256px webp child asset) and `ai-tag-asset` (v1 stub: appends `ai-tags-coming-soon` when the
uploader opted in). **Implemented 2026-07-07** (handlers + `ffmpeg.ts` wrapper + template edit +
`resolve-asset` self-copy guard; `pnpm build` green). Sections marked **(v2 draft)**. Driven by
`.claude/issues/addressed/0350__storage___asset-image-thumbnails__________LOW__.plan.md`; decisions locked 2026-07-06: 256px/webp,
children hidden from all lists, failures are dashboard-only best-effort.

Every upload lands in `quarantine/` with `scan_status='pending'` (see `endpoint.data.md`). This
file specs the **`asset-scan` workflow** that scans the object with ClamAV and promotes (clean) or
purges (infected) it. Its handlers run in **`apps/worker-app`** — the stack's single dedicated
graphile-worker process (relocated 2026-07-06 from storage-layer per final-eval Plan D; the
original two-worker topology raced on the fresh-DB `graphile_worker` schema install).

## Why a workflow (and why async at all)

- **Uploads never block on `clamd`.** Upload latency + memory are decoupled from ClamAV (slow first
  boot, ~1–2 GB signature DB). Upload returns 202 immediately.
- **Retries/backoff for scanner blips** are owned by the pipeline itself, NOT graphile-worker:
  `wf_fn.queue_workflow` enqueues with `max_attempts := 1` and the `_workflow-handler` factory
  converts throws into `error_uow`, so the worker never retries. Short transient retries live
  in-handler (`scan-asset`); the long horizon (clamd cold boot) is owned by the reaper, which
  re-queues fresh workflows up to a cap (see Reaper below).
- **Observable** in the existing Workflow Dashboard (site-admin tool → `/graphql-api/workflow`).
- **Extensible**: thumbnailing, OCR, metadata extraction are future uows in the same DAG.
  **(v2 draft)** Thumbnailing + AI tagging are landing as exactly that — two new uows.
- The schema was designed for this: `scan_status` already models `pending | clean | infected | error`.

## Responsibilities (the contract — all must hold)

1. **Accept a reference, not bytes.** Workflow input is `{ assetId }`. Handlers load the row and
   fetch bytes from MinIO themselves.
2. **Never serve unscanned bytes.** Objects start under `quarantine/` (no anon policy, no presign
   path); promotion to `public/…` or `private/…` happens only on a `clean` verdict.
3. **Exactly one terminal verdict per asset:** `clean` (promote object, update `storage_key`, set
   `scan_status='clean'`), `infected` (delete quarantine object, set `infected` + `scan_signature`,
   soft-delete `asset_status='deleted'`), or `error` (leave bytes in quarantine, set `error` for
   operator review).
4. **Idempotent / re-runnable.** `storage_fn.resolve_asset_scan` guards on `scan_status='pending'`
   (see `_shared.data.md`); S3 promote uses Copy+Delete which tolerates re-runs (re-copy is a no-op
   overwrite; delete of a missing key is ignored).
5. **Retry transient failures** (clamd warming up / down) with backoff before declaring `error`.
6. **Gate reads on `clean`** — `downloadUrl` is null unless `clean` (`graphql.data.md`); public
   read fns filter `scan_status='clean'` (`_shared.data.md`).
7. **Surface completion** — v1: UI refresh/poll flips `PENDING → CLEAN/INFECTED`; pg-notify/socket
   push (msg-layer `pg-notify-bridge` precedent) is a later refinement.
8. **No stranded assets.** A reaper re-enqueues or flags rows `pending` older than T.

## The template — `wf_fn.upsert_wf` (seeded lazily per tenant)

Seeded by **`storage_fn.ensure_asset_scan_wf(_tenant_id)`** (see `_shared.data.md`), called in the
upload transaction before `wf_api.queue_workflow`. A minimal two-uow DAG: **scan → resolve**
(resolve waits on scan). Clean-vs-infected is decided *inside* the `resolve-asset` handler (reads
the verdict from the shared `workflow_data`) — the engine is dependency-ordered, not
conditionally-branched.

**(v2 draft) The DAG becomes a diamond** — edit `…10630_storage_ensure_asset_scan_wf.sql` **in
place** (no new sqitch change; dev rebuild re-seeds the template):

```
scan-asset ──▶ resolve-asset ──▶ thumbnail-asset
                             └─▶ ai-tag-asset
```

- Two more `wf_fn.uow_info` rows: `thumbnail-asset` and `ai-tag-asset` (both `'task'`,
  `use_worker = true`, `workflow_handler_key` = own identifier, parent `'asset-scan'`), plus two
  dependency rows: `('thumbnail-asset','resolve-asset')` and `('ai-tag-asset','resolve-asset')`.
  The processing steps are independent → parallel, both gated on the promoted object.
- One more input definition:
  `row('aiTagsRequested'::citext, 'boolean'::wf.workflow_input_data_type, 'false'::citext, false)`
  — optional, default false; the upload endpoint passes it
  (`jsonb_build_object('assetId', …, 'aiTagsRequested', …)`, see `endpoint.data.md`).
- Conditionality stays **inside the handlers** (image? clean? requested? already done?) — the
  house pattern; the DAG is never branched.
- `asset-scan-completed` (on-completed) now fires after both processing uows — unchanged.
- **Seed-once gap (recorded):** `ensure_asset_scan_wf` only seeds when no template exists, so an
  already-seeded tenant in a *persistent* env would keep the 2-uow template. Moot in dev (rebuild
  wipes + re-seeds); a real template-migration story is deferred until a deployed env exists.

```sql
select wf_fn.upsert_wf(
  row(
    'asset-scan'::citext                 -- identifier
    ,'asset-scan'::citext                -- type
    ,'Asset Malware Scan'::citext        -- name
    ,'Scan an uploaded asset, then promote (clean) or purge (infected).'::citext
    ,array[
      row(
        'scan-asset'::citext             -- identifier
        ,'Scan asset'::citext
        ,'Fetch bytes from quarantine and run ClamAV'::citext
        ,'task'::wf.uow_type
        ,'{}'::jsonb                     -- data
        ,null::citext                    -- wf_id
        ,'asset-scan'::citext            -- parent_uow_id (root)
        ,null::timestamptz               -- due_at
        ,'scan-asset'::citext            -- workflow_handler_key
        ,true                            -- use_worker
      )::wf_fn.uow_info
      ,row(
        'resolve-asset'::citext
        ,'Resolve asset'::citext
        ,'Promote to final prefix if clean; purge + mark infected otherwise'::citext
        ,'task'::wf.uow_type
        ,'{}'::jsonb
        ,null::citext
        ,'asset-scan'::citext
        ,null::timestamptz
        ,'resolve-asset'::citext
        ,true
      )::wf_fn.uow_info
    ]::wf_fn.uow_info[]
    ,array[
      row('resolve-asset'::citext, 'scan-asset'::citext)::wf_fn.uow_dependency_info
    ]::wf_fn.uow_dependency_info[]
    ,'asset-scan-completed'::citext      -- on_completed_workflow_handler_key
    ,array[
      row('assetId'::citext, 'string'::wf.workflow_input_data_type, null::citext, true)::wf.workflow_input_definition
    ]::wf.workflow_input_definition[]
  )::wf_fn.wf_info
  ,_tenant_id
);
```

Signature verified de facto (2026-07-06): the seeded template cloned and completed real
`asset-scan` workflows against the deployed `db/fnb-wf/deploy/00000000010520_wf_fn.sql`.

## Queue path (upload endpoint — verified)

`wf_api.queue_workflow('asset-scan', jsonb_build_object('assetId', <id>))` inside the upload
transaction. Verified behavior of `wf_fn.queue_workflow`: clones the template for `jwt.tenant_id()`
and **enqueues the initial task uows itself in SQL** via
`graphile_worker.add_job(workflow_handler_key, payload := to_json(uow), …)` — atomic with the
asset row. Do **not** also schedule from JS (the GraphQL `queueWorkflow` mutation wrapper does
that; the upload path is SQL-only).

## Handlers (`apps/worker-app/server/lib/worker-task-handlers/`)

Registered in worker-app's union taskList (wf generic + wf-exerciser + asset-scan), each wrapped by
the single `_workflow-handler.ts` factory (the former graphql-api-app/storage-layer duplicates were
consolidated here — it wraps handlers with `wf_fn.complete_uow`/`wf_fn.error_uow` + follow-on
`addJob` scheduling via a module-level lazy `workerUtils` singleton, and uses `useFnbPgClient()`
from `@function-bucket/fnb-auth-server`).

- **`scan-asset.ts`** — read `assetId` from workflow input → load the asset row (bucket, quarantine
  `storage_key`, `scan_status`) → **idempotency guard:** if `scan_status != 'pending'` (an earlier
  run already resolved it — the object may have moved), short-circuit complete with the existing
  verdict instead of rescanning → `GetObject` from MinIO → `clamscan.scanStream` → `completeUow`
  with `step_data = { verdict: 'clean' | 'infected', signature }` (also mirrored into
  `workflow_data` as `scanVerdict`/`scanSignature`, which is what `resolve-asset` actually reads).
  On scanner unreachable/error it
  retries in-handler with backoff (`SCAN_RETRIES`, ~1 min); on exhaustion the outcome depends on
  the workflow-attempt count for this asset (`_asset-scan-config.ts`, cap
  `ASSET_SCAN_MAX_WF_ATTEMPTS`, default 3): attempts remaining → **throw** (workflow errors, the
  reaper queues a fresh one next tick); final attempt → **return an `'error'` verdict** so
  `resolve-asset` records the terminal `scan_status='error'` and the workflow completes cleanly
  with an error resolution (bytes stay in quarantine for operator review). Throws for programmer
  errors (missing assetId, missing row) always error the workflow.
- **`resolve-asset.ts`** — read the verdict from `workflow_data` (`scanVerdict`/`scanSignature`).
  **Clean:** compute the final key — a prefix swap `quarantine/` → `public|private/` per the
  row's `is_public` (same `[tenant]/[context]/[entity]/[uuid].[ext]` suffix),
  `CopyObject` quarantine → final, `DeleteObject` quarantine, then
  `storage_fn.resolve_asset_scan(assetId, 'clean', null, finalKey)`. **Infected:** `DeleteObject`
  quarantine, then `storage_fn.resolve_asset_scan(assetId, 'infected', signature, null)`.
  **(v2 draft) hardening:** skip the Copy+Delete when `storage_key` no longer starts with
  `quarantine/` — on a re-run against an already-promoted asset the prefix swap no-ops, making
  `finalKey === storage_key`, and MinIO rejects the S3 self-copy (the DB call was already
  idempotent; this makes the S3 side match).
- **(v2 draft) `thumbnail-asset.ts`** — new. Loads the row
  (`bucket, storage_key, content_type, scan_status`); **short-circuits complete-with-note** when
  `scan_status != 'clean'`, when `content_type` is not in `IMAGE_TYPES`
  (`image/png|jpeg|webp|gif`), or when a thumbnail child already exists (idempotency:
  `parent_asset_id = $1 and 'thumbnail' = any(tags)`). Otherwise: `GetObject` the promoted
  object → **ffmpeg** (see Image tooling below) → 256px-max webp Buffer → child key **in the
  parent's final directory** — `<public|private>/<tenant>/<context>/<entity>/<thumbId>.webp`
  (dirname of the parent key; `thumbId` generated app-side so row id matches the key) →
  `PutObject` (ContentType `image/webp`) → sha256 →
  `storage_fn.insert_derived_asset(parentId, thumbId, key, 'webp', 'image/webp', bytes,
  checksum, array['thumbnail'])`. Derived assets never touch `quarantine/` (born clean —
  `_shared.data.md`).
- **(v2 draft) `ai-tag-asset.ts`** — new. Reads `assetId` + `aiTagsRequested` from
  `workflowData.workflowInputData`; short-circuits complete-with-note when not requested, not
  `clean`, or not an image. v1 stub — **no AI call**:
  `storage_fn.add_asset_tags(assetId, array['ai-tags-coming-soon'])` (set-union — re-runs can't
  duplicate), with a `// v2: replace with real AI tagging` marker. The real integration later
  swaps this one call and removes the placeholder tag.
- **`asset-scan-completed.ts`** (on-completed handler) — v1: log only. Later: pg-notify → socket
  push so the UI flips the badge live (msg `pg-notify-bridge` pattern).

Both new identifiers (`thumbnail-asset`, `ai-tag-asset`) register in worker-app's union taskList
(`worker-task-handlers/index.ts`) — unique across the stack, like all task identifiers.

### (v2 draft) Processing-step failure semantics — dashboard-only, best-effort (locked)

The reaper watches `scan_status='pending'` assets only, so once `resolve-asset` lands the `clean`
verdict **nothing re-queues an errored processing uow** — thumbnails and AI tags are
best-effort. Each handler does a short in-handler transient retry (mirroring `scan-asset`'s
pattern, fewer attempts — S3/DB blips only), then **throws** on exhaustion so the workflow shows
an error resolution in the Workflow Dashboard. The original asset is unaffected (already `clean`,
downloadable); the UI simply has no thumbnail / no tag. A reaper extension that retries missing
thumbnails/tags was considered and deferred (v-next). Programmer errors (missing assetId/row)
always throw.

### (v2 draft) Image tooling — ffmpeg in a dedicated worker image (locked 2026-07-06)

**ffmpeg, not sharp** — video assets (poster frames, transcodes) are anticipated, so the
system-binary cost is taken now. worker-app leaves the shared `apps/auth-app/Dockerfile` for its
own `apps/worker-app/Dockerfile` (alpine + `apk add --no-cache ffmpeg` — `infrastructure.md`).

- Invocation: `spawn` (never `exec` — binary stdout) with pipes, no temp files: S3 bytes →
  stdin, webp ← stdout. Wrapper `apps/worker-app/server/lib/ffmpeg.ts` —
  `thumbnailWebp(input: Buffer, maxPx: number): Promise<Buffer>` — collects stdout, captures
  stderr into the thrown Error (readable in the Workflow Dashboard) on non-zero exit.
- Pinned args (geometry locked: **256px max dimension, aspect-preserving, never enlarge, webp**):
  ```
  ffmpeg -hide_banner -loglevel error -i pipe:0 \
    -frames:v 1 \
    -vf "scale='min(256,iw)':'min(256,ih)':force_original_aspect_ratio=decrease" \
    -f webp pipe:1
  ```
  `-frames:v 1` takes the first frame of animated GIFs. png/jpeg/webp/gif all pipe cleanly
  (single-image demuxers need no seekable input); if a future **video** container needs seeking,
  fall back to a container-tmpdir temp file — recorded, not built.
- SVG is not an allowed upload type — no rasterization concern.

Task identifiers **must stay unique across the whole stack** — the shared `graphile_worker` schema
routes jobs by identifier. With the single worker this is now a naming rule inside one
`index.ts` union taskList rather than a cross-app coordination problem.

## Worker plugin (`apps/worker-app/server/plugins/graphile-worker.ts`)

The stack's **only** graphile-worker migrator + runner (library mode):
`makeWorkerUtils({ connectionString })` → `utils.migrate()` (idempotent) →
`run({ connectionString, taskList, crontab })`; stop the runner + release utils on Nitro `close`.
Default `graphile_worker` schema (shared queue — that's what makes the SQL enqueue work). The
migrate calls keep a transient-error retry wrapper as insurance for a future horizontally-scaled
worker (2+ worker-app replicas racing the schema install is the same race the consolidation
removed). Producers elsewhere stay runner-less: graphql-api-app's `_scheduleUows` is a lazy
`makeWorkerUtils` (first `queueWorkflow` mutation, post-boot); the upload path enqueues in SQL.

## Reaper (stuck `pending`) — `asset-scan-reaper.ts`

No asset may strand in `pending`. A graphile-worker **cron** entry in worker-app's runner
(cadence `ASSET_SCAN_REAPER_CRON`, default every **15 min**; threshold `ASSET_SCAN_STUCK_MINUTES`,
default 15) runs two phases over pending assets older than the threshold:

- **Phase A — lost job:** the workflow is live (`scan-asset` uow still `incomplete`) but nothing is
  running — re-`addJob` the same uow. Idempotency is guaranteed by `resolve_asset_scan`'s `pending`
  guard + Copy/Delete semantics.
- **Phase B — errored workflow:** no live workflow exists (root uow terminal). If fewer than
  `ASSET_SCAN_MAX_WF_ATTEMPTS` (default **3**) workflows have run for the asset, queue a fresh one
  via `wf_fn.queue_workflow` (SECURITY DEFINER, takes `tenant_id` explicitly — no claims needed on
  the worker connection; it enqueues initial jobs itself in SQL). At the cap, `scan-asset` itself
  returns the terminal `'error'` verdict; the reaper's direct
  `storage_fn.resolve_asset_scan(_, 'error', null, null)` is only the backstop for a final workflow
  that died before `resolve-asset` ran.

Worst-case time-to-terminal-error at defaults ≈ threshold × cap (~45 min); clamd's 1–3 min cold
boot is covered by the first reaper retry.

**Operator flow for `error` rows (v1):** the row shows the `warning` "Scan error" badge on
`/storage/assets` (`_shared.data.md` badge map); bytes remain in quarantine for review; recovery is
**re-upload**. A "re-scan" admin action is a v2 item.

Implemented 2026-07-07: `minio-init` adds an `mc ilm` lifecycle rule expiring `quarantine/*`
objects older than 7 days — cleans orphans from step-5 failures (see `endpoint.data.md`) and
bounds the review window for terminal-`error` objects.

## Trade-offs accepted (vs. the rejected sync design)

- **Infected bytes briefly touch storage** (quarantine) before deletion — mitigated: quarantine is
  private, purged on verdict, lifecycle-expired.
- **Pending window:** an asset exists but isn't downloadable yet; the UI must render `PENDING`
  (`components.ui.md`) and `downloadUrl` is null.
- **Object move cost** for clean assets (Copy+Delete) — negligible at ≤5 MB. Applied uniformly to
  public AND private (decided: uniformity over the micro-optimization of writing private objects
  directly to their final key).

## Considered & rejected
- **Option A — bare graphile-worker `scan-asset` task.** Lighter, but no dashboard observability,
  no on-completed hook, and no natural home for future processing steps. The wf engine + SQL
  enqueue were already there; the marginal cost of the template is small.
- **Sync scan in the upload request** — the original v1; superseded (see README).

## Open questions
- [ ] Template ownership: lazy per-tenant `ensure_asset_scan_wf` (specced) vs anchor-only seed
      resolved system-wide.
- [x] Reaper cadence + max re-runs before `error` + operator flow — resolved 2026-07-06: 15 min /
      cap 3 / "Scan error" badge + re-upload (env-tunable; see Reaper section).
- [x] `wf_fn.upsert_wf` signature — verified de facto against the deployed engine (see above).
- [x] (v2) Thumbnail geometry/format — resolved 2026-07-06: 256px max dimension, webp.
- [x] (v2) Processing-step failure handling — resolved 2026-07-06: dashboard-only best-effort
      (in-handler retries → throw); no reaper extension in v1.
- [ ] (v2) Deployed-env migration for the seed-once template (2-uow → 4-uow) — moot in dev;
      needed before any persistent environment exists.
- [ ] Later: pg-notify push for live badge flips (v1 = refresh/poll).
- [ ] Later: "re-scan" admin action for `error` rows (v1 = re-upload).
- [ ] Later: real AI tagging replaces the `ai-tag-asset` stub (swap the `add_asset_tags` call;
      remove the `ai-tags-coming-soon` placeholder).

## Reference
- graphile-worker patterns: use the `graphile-worker-expert` skill.
- Worker wiring (single instance): `apps/worker-app/server/plugins/graphile-worker.ts`,
  `apps/worker-app/server/lib/worker-task-handlers/index.ts`, `_workflow-handler.ts`.
- wf template example: `apps/worker-app/server/lib/worker-task-handlers/wf-exerciser/load-workflow-exerciser.sql`.
- SQL enqueue sites: `db/fnb-wf/deploy/00000000010520_wf_fn.sql` (`queue_workflow`, `pull_trigger`).
