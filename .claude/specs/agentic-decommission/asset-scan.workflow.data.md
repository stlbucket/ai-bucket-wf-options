---
name: agentic-decommission-asset-scan
description: The asset-scan pipeline converted from the agentic engine to n8n — the scan→resolve→thumbnail/ai-tag diamond as a fixed node graph on the custom image, the asset-scan-reaper Schedule Trigger workflow, the upload-endpoint retarget, and the security argument for the fixed DAG replacing the agentic atomic tool.
metadata:
  type: reference
---

## Status
**Built + live-verified 2026-07-21** (plan 0017, Phase 3). `n8n/workflows/asset-scan.json`
(28 nodes) + `asset-scan-reaper.json` built via the n8n public API/`n8n-cli` and exported active.
Verified live against n8n + clamav + minio: clean (promote quarantine→private, run success),
infected (EICAR → signature `Eicar-Test-Signature` parsed, purge, soft-delete), image clean with
`aiTagsRequested` (webp thumbnail child tagged `{thumbnail}` + parent tagged
`{ai-tags-coming-soon}`), and the already-resolved idempotency short-circuit. Contract inherited
unchanged; the node design was carried from the superseded
`.claude/specs/n8n-workflow-engine/asset-scan.workflow.data.md`.

**Build corrections (authoritative where they differ from the body below):**
- **Promote = re-read `/home/node/.n8n-files/scan-<id>` (the scan file) → S3 upload to finalKey →
  S3 delete quarantine.** The n8n S3 node's copy uses `x-amz-copy-source` (formatting-fragile);
  reusing the already-downloaded scan file is simpler and needs no second download.
- **clamdscan verdict:** Execute Command **throws on non-zero exit** (1=infected, 2=error), losing
  the code — so the command is wrapped `clamdscan … 2>&1; echo "CLAMEXIT:$?"` (shell exits 0) and a
  Code node parses the exit + the `… FOUND` signature.
- **Thumbnail checksum** comes from `sha256sum` **inside** the ffmpeg Execute Command
  (`ffmpeg … && sha256sum … && stat -c%s …`), parsed in a Code node — no separate Crypto/hash node.
  ffmpeg has libwebp; scale `w=256:h=256:force_original_aspect_ratio=decrease`. Best-effort:
  `onError: continueRegularOutput` + a skip flag so a thumbnail failure never fails the run.
- **Idempotency** is an `Is Pending` IF node after Get Asset (not-pending → complete_run
  `already-resolved`) — the reaper relies on this for re-fires of resolved assets.
- **Four n8n-2.x hardening gotchas** (memory `project_n8n_hardened_image`): hardened image
  (multi-stage lib-copy, no `apk`); Execute Command disabled → `NODES_EXCLUDE=[]`;
  `restrictFileAccessTo` defaults to `~/.n8n-files` → scan/thumb files live there;
  n8n won't create that dir → `mkdir` in the Dockerfile.
- No `get_asset` tool — a Postgres `asset_for_scan` node; carried-forward values via
  `$('NodeName').item.json…` references (assetId, run_id, asset, verdict, finalKey).
- **Repo export shape:** `n8n-cli workflow get --json` returns a bloated object whose `shared`
  project ref breaks the `n8n-import` boot loop on a fresh `n8n_engine` (workflow_entity FK
  violation). The committed `n8n/workflows/*.json` are stripped to
  `{ id, name, active, nodes, connections, settings, pinData }` (memory `project_n8n_hardened_image`).

## Inherited contract (all eight responsibilities still hold)

Reference-not-bytes input (`{ assetId }`); never serve unscanned bytes (quarantine-first);
exactly one terminal verdict (`clean` promote / `infected` purge+soft-delete / `error`
leave-in-quarantine); idempotent re-runs (`storage_fn.resolve_asset_scan` guards on
`scan_status='pending'`; S3 Copy+Delete tolerates re-runs); transient-failure retry before
`error`; reads gated on `clean`; completion surfaced by UI poll; **no stranded assets** (reaper).

---

## Trigger — upload endpoint retarget (`packages/storage-layer/server/api/upload.post.ts`)

The endpoint already POSTs asset-scan after commit (the agentic migration replaced the in-txn
`wf_api.queue_workflow` with a post-commit trigger). This changes the **target only**:

- `${AGENT_INTERNAL_URL}/api/trigger/asset-scan` + header `x-fnb-trigger-secret` **→**
  `${N8N_INTERNAL_URL}/webhook/asset-scan` + header `x-fnb-webhook-secret`.
- Body unchanged: `{ assetId, tenantId, aiTagsRequested }`.
- Still fire-and-forget; a failed POST is logged and **swallowed** — the asset stays `pending`
  and the reaper picks it up (the reaper owns the lost-trigger horizon, same as today).

`asset-scan` stays absent from the `triggerWorkflow` registry (`_shared.data.md`) — the upload
endpoint and the reaper are its only callers.

---

## Workflow: `asset-scan` (`n8n/workflows/asset-scan.json`)

```
Webhook(asset-scan, Header-Auth fnb-webhook-secret, respond: immediately)
 ─▶ PG n8n_fn.begin_run('asset-scan', {{ $execution.id }}, body, tenantId) → runId
 ─▶ PG storage_fn.asset_for_scan(assetId) → { key, mime_type, scan_status, tenant_id }
 ─▶ S3 Get(quarantine key) ─▶ Write Binary File /tmp/<assetId>
 ─▶ Execute Command: clamdscan --config-file=/etc/clamav/clamd-remote.conf --no-summary --stream /tmp/<assetId>
      (node retryOnFail: 5 tries, 5s wait — replaces the in-handler transient loop; n8n caps wait at 5s)
 ─▶ Code: parse exit code → verdict (0=clean, 1=infected + signature line, 2=error + detail)
 ─▶ IF verdict
      ├─ clean:    S3 Copy(quarantine→final) ─▶ S3 Delete(quarantine)
      │              ─▶ PG storage_fn.resolve_asset_scan(assetId,'clean',null,null)
      │              ─▶ IF mime_type LIKE 'image/%' (thumbnail branch, best-effort):
      │                   S3 Get(final) ─▶ Write /tmp ─▶ Execute Command: ffmpeg … 256px webp
      │                   ─▶ Read /tmp ─▶ S3 Put(child key) ─▶ PG storage_fn.insert_derived_asset(...)
      │                   (onError: continueErrorOutput → record thumbnail:'failed', do not fail the run)
      │              ─▶ IF aiTagsRequested (ai-tag branch):
      │                   PG storage_fn.add_asset_tags(assetId, '{ai-tags-coming-soon}')
      ├─ infected: S3 Delete(quarantine) ─▶ PG resolve_asset_scan(assetId,'infected',signature,null)
      └─ error:    PG resolve_asset_scan(assetId,'error',null,detail)   (bytes stay in quarantine)
 ─▶ Execute Command: rm -f /tmp/<assetId>*   (also reachable on the error path)
 ─▶ Merge ─▶ PG n8n_fn.complete_run(runId, { verdict, signature?, thumbnail, aiTags })
```

| Concern | n8n mechanism |
|---|---|
| Auth | Webhook Header-Auth credential `fnb-webhook-secret` |
| DB calls | Postgres nodes, credential `fnb-n8n-worker` (role `n8n_worker`); **only** the granted fns (`n8n_fn.begin_run/complete_run`, `storage_fn.asset_for_scan/resolve_asset_scan/insert_derived_asset/add_asset_tags`) |
| Bytes | S3 node against MinIO, credential `fnb-minio` (path-style, endpoint `$env.S3_ENDPOINT`, bucket `$env.S3_BUCKET`) — `infrastructure.md` |
| clamd | Execute Command → `clamd-remote.conf` TCP to the `clamav` container; node-level `retryOnFail` (5 / 5s) is the transient retry |
| ffmpeg | Execute Command on `/tmp` files (custom image) |
| Branching | IF nodes — the diamond lives in the graph (no model, no handler conditionality) |
| Diamond join | Merge before `complete_run` (thumbnail ∥ ai-tag, both gated on `clean`) |
| Cleanup | trailing `rm -f /tmp/<assetId>*`, error path included |
| Failure catch-all | Error Workflow = `error-handler` → `n8n_fn.error_run_by_execution` (the shared terminal-error path) |
| `saveDataSuccessExecution` | `'none'` (+ `saveDataErrorExecution: 'all'`) — house n8n default; only errored executions are persisted for the editor log |

Definition notes:
- `resolve_asset_scan` is idempotent (guards `pending`) — a reaper re-fire of an
  already-resolved asset is a no-op reporting the recorded verdict. The S3 Copy+Delete tolerates
  re-runs (final already present / quarantine already gone).
- The thumbnail branch is **best-effort**: its failure is caught (`continueErrorOutput`) and
  recorded as `thumbnail: 'failed'` in `complete_run`'s `result_data`; the run stays `success`.
  A `clean` verdict is never rolled back by a thumbnail failure.
- No `get_asset`/`scan_and_resolve`/`make_thumbnail` tools, no goal prompt, no `maxTurns`, no
  per-run model cost — the agentic toolbox and harness disappear entirely.

---

## Workflow: `asset-scan-reaper` (`n8n/workflows/asset-scan-reaper.json`)

Replaces the croner job in `apps/agent-app/server/plugins/agent-scheduler.ts`.

```
Schedule Trigger (cron — the old ASSET_SCAN_REAPER_CRON default, baked into the node)
 ─▶ PG storage_fn.stuck_pending_assets($env.ASSET_SCAN_STUCK_MINUTES, $env.ASSET_SCAN_MAX_WF_ATTEMPTS)
 ─▶ Split In Batches (sequential)
 ─▶ HTTP Request: POST ${self}/webhook/asset-scan  { assetId, tenantId, aiTagsRequested }
      (Header-Auth fnb-webhook-secret — one trigger path for fresh and reaped scans)
```

- `storage_fn.stuck_pending_assets(stuck_minutes, max_attempts)` is the existing reaper helper,
  reworked (`_shared.data.md`) to read **`n8n.workflow_run`**: returns `pending` assets past the
  threshold whose asset-scan attempt count is under the cap and that have no live run; assets **at
  the cap** are flipped to terminal `scan_status='error'` for operator review (idempotent
  `resolve_asset_scan`). `ai_tags_requested` is recovered from the most recent prior run's input
  (false when no run ever began — the upload POST was lost).
- The reaper POSTs its own instance's webhook (compose-internal) with the same secret credential.
- **No croner, no `agent_fn.sweep_orphaned_runs` boot sweep** — n8n owns execution lifecycle;
  the `error-handler` marks crashed/failed executions terminal, and `running_count`-based
  singleton concerns are the sync workflows' single-engine guard, not asset-scan (asset-scan is
  not singleton — concurrent scans of different assets are normal).
- `ASSET_SCAN_REAPER_CRON` env var retires (cadence is in the Schedule Trigger JSON). The
  `ASSET_SCAN_STUCK_MINUTES` / `ASSET_SCAN_MAX_WF_ATTEMPTS` tunables are read as `$env.*` on the
  n8n service (`infrastructure.md`).

---

## Security — the fixed DAG replaces the agentic atomic tool

The agentic spec made scan+promote **one atomic tool** for a specific reason: a *model*
orchestrated the workflow, and a model must never be able to mis-sequence promote-before-scan or
manufacture a verdict. **n8n removes the model.** The verdict is a `Code` node parsing a
`clamdscan` exit code; the promote is an S3 Copy/Delete reachable **only** through the `clean`
branch of the verdict IF node. There is no path to the promote nodes that bypasses the scan, and
no actor that can reorder them — the graph is fixed, versioned in `n8n/workflows/asset-scan.json`,
and code-reviewed like any other workflow. This is the same posture as the `game-event` referee
(`.claude/specs/game-server/` — the workflow is the sole authority for the state transition).
`resolve_asset_scan`'s `scan_status='pending'` guard remains the DB-level backstop against double
resolution. No additional DB constraint is warranted (README → Considered & rejected).

---

## Decommissioned by this file (detail in `decommission.data.md`)

The agentic asset-scan definition + tools (`agent-workflows/asset-scan.ts`,
`agent-tools/{asset-scan,clam,ffmpeg,s3}.ts`), the croner scheduler
(`server/plugins/agent-scheduler.ts`) and `agent_fn.sweep_orphaned_runs`, the
`apps/agent-app/clamd-remote.conf` (moves to `docker/n8n/`), and the upload endpoint's
`AGENT_*` target. `.claude/specs/asset-storage/asset-scan-workflow.data.md`'s superseded-by
pointer is repointed from the agentic file to this one (R21, README Phase 5).
