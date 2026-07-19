---
name: n8n-asset-scan-workflow
description: n8n conversion of the asset-scan pipeline (scan → resolve → thumbnail/ai-tag diamond) plus the asset-scan-reaper cron workflow and the upload-endpoint trigger change.
metadata:
  type: reference
---

## Status
Draft. Converts `.claude/specs/asset-storage/asset-scan-workflow.data.md` (v2 diamond) from the
wf/graphile-worker engine to n8n. The **contract is inherited unchanged** — this file specs the
new execution shape only.

## Inherited contract (all eight responsibilities still hold)

From the original spec: reference-not-bytes input (`{ assetId }`); never serve unscanned bytes
(quarantine-first); exactly one terminal verdict (`clean` promote / `infected` purge+soft-delete /
`error` leave-in-quarantine); idempotent re-runs (`storage_fn.resolve_asset_scan` guards on
`scan_status='pending'`; S3 Copy+Delete tolerates re-runs); transient-failure retry before
`error`; reads gated on `clean`; completion surfaced by UI poll; **no stranded assets** (reaper).

---

## Trigger — upload endpoint change (`packages/storage-layer/server/api/upload.post.ts`)

Today: `storage_fn.ensure_asset_scan_wf(tenant)` + `wf_api.queue_workflow('asset-scan', …)`
inside the upload transaction (SQL enqueue was atomic with the asset row). New:

1. The upload transaction commits the asset row (`scan_status='pending'`) — no wf calls at all.
2. **After commit**, POST to `${N8N_INTERNAL_URL}/webhook/asset-scan` with the secret header and
   body `{ assetId, tenantId, aiTagsRequested }`. Response `202`-style fire-and-forget; a failed
   POST is logged and **swallowed** — the asset stays `pending` and the reaper picks it up.

The atomic-enqueue guarantee is knowingly traded for webhook + reaper coverage (Locked decision;
the reaper already owned the lost-job horizon in the old design). `ensure_asset_scan_wf` and its
deploy script retire (`decommission.data.md`).

---

## Workflow: `asset-scan` (`n8n/workflows/asset-scan.json`)

```
Webhook(asset-scan) ─▶ begin_run ─▶ asset_for_scan ─▶ S3 Get(quarantine) ─▶ Write /tmp
  ─▶ clamdscan --stream (retry: 5 tries, 30s backoff)
  ─▶ Parse verdict (Code: exit 0=clean, 1=infected + signature, 2=error)
  ─▶ IF verdict
       ├─ clean:    S3 Copy(quarantine→final) ─▶ S3 Delete(quarantine) ─▶ PG resolve_asset_scan('clean')
       │              ─▶ ┬─ thumbnail branch (IF image/*):
       │                 │    S3 Get(final) ─▶ Write /tmp ─▶ ffmpeg (256px webp) ─▶ Read /tmp
       │                 │    ─▶ S3 Put(child key) ─▶ PG insert_derived_asset
       │                 │    (failure = best-effort: continue-on-fail, recorded in result_data)
       │                 └─ ai-tag branch (IF aiTagsRequested):
       │                      PG add_asset_tags(assetId, '{ai-tags-coming-soon}')
       ├─ infected: S3 Delete(quarantine) ─▶ PG resolve_asset_scan('infected', signature)
       └─ error:    PG resolve_asset_scan('error', detail)   (bytes stay in quarantine)
  ─▶ Merge ─▶ complete_run(result_data: verdict + branch outcomes)
```

Node notes:

| Concern | n8n mechanism |
|---|---|
| Auth | Webhook Header Auth credential `fnb-webhook-secret` |
| DB calls | Postgres nodes, credential `fnb-n8n-worker`; **only** the granted fns from `_shared.data.md` (`n8n_fn.begin_run/complete_run`, `storage_fn.asset_for_scan/resolve_asset_scan/insert_derived_asset/add_asset_tags`) |
| Bytes | S3 node against MinIO (credential `fnb-minio`, path-style, endpoint `$env.S3_ENDPOINT`) |
| clamd | Execute Command: `clamdscan --config-file=/etc/clamav/clamd-remote.conf --no-summary --stream /tmp/<assetId>`; **node-level retry** (`retryOnFail`, maxTries 5, wait 30s) replaces the in-handler transient retry loop |
| ffmpeg | Execute Command on `/tmp` files (custom image, `infrastructure.md`); replaces `server/lib/ffmpeg.ts` |
| Branching | IF nodes — conditionality lives in the graph now (the old "conditionality stays inside handlers because the DAG can't branch" rule is obsolete: n8n DAGs branch natively) |
| Diamond join | Merge node before `complete_run` (thumbnail ∥ ai-tag, both gated on clean) |
| Cleanup | trailing Execute Command `rm -f /tmp/<assetId>*` (also on the error path) |
| Failure catch-all | Error Workflow = `error-handler` → `n8n_fn.error_run_by_execution` (replaces `_workflowHandler`'s catch → `wf_fn.error_uow`) |

`asset-scan-completed` (the old no-op on-completed uow) folds into `complete_run` — no separate
node. The old `close-workflow-wf`/`wait`/`acknowledge-trigger` no-op handlers have no analog and
simply disappear.

---

## Workflow: `asset-scan-reaper` (`n8n/workflows/asset-scan-reaper.json`)

```
Schedule Trigger (cron, from the old ASSET_SCAN_REAPER_CRON default)
  ─▶ PG storage_fn.stuck_pending_assets($env.ASSET_SCAN_STUCK_MINUTES, $env.ASSET_SCAN_MAX_WF_ATTEMPTS)
  ─▶ Split In Batches (sequential)
  ─▶ HTTP Request → POST ${self}/webhook/asset-scan  { assetId, tenantId, aiTagsRequested }
```

- `storage_fn.stuck_pending_assets(stuck_minutes, max_attempts)` (new, `fnb-storage`): returns
  assets `scan_status='pending'` older than the threshold whose attempt count — `count(*) from
  n8n.workflow_run where workflow_key='asset-scan' and input_data->>'assetId' = …` — is below the
  cap; assets at the cap are flipped to `scan_status='error'` for operator review (same semantics
  as the retired `asset-scan-reaper.ts`).
- The reaper POSTs to its own instance's webhook (localhost-internal) with the same secret
  credential — one trigger path for fresh and reaped scans.

---

## Decommissioned by this file

Handlers `scan-asset`, `resolve-asset`, `thumbnail-asset`, `ai-tag-asset`,
`asset-scan-completed`, `asset-scan-reaper`, the `clam.ts`/`ffmpeg.ts`/`s3.ts` libs, the
`storage_fn.ensure_asset_scan_wf` deploy script, and the graphile-worker crontab entry — full
inventory in `decommission.data.md`. `.claude/specs/asset-storage/asset-scan-workflow.data.md`
gets a superseded-by pointer to this file (R21 propagation, README Phase 7).
