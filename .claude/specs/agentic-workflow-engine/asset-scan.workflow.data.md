---
name: agentic-asset-scan-workflow
description: Agentic conversion of the asset-scan pipeline — deterministic scan/promote tool, agent-orchestrated thumbnail/ai-tag branches, the deterministic reaper cron, and the upload-endpoint trigger change.
metadata:
  type: reference
---

## Status
**Implemented 2026-07-17** — verified live: clean promote (quarantine object purged), webp
thumbnail child, stub tag, and the reaper re-firing a backdated pending asset on its `*/15`
tick. Corrections from the build:
- `storage_fn.stuck_pending_assets` recovers `ai_tags_requested` from the **most recent prior
  run's** `input_data` (`false` when the asset never got a run — the upload-time POST was lost
  before any run began), and flips at-cap assets to `error` via the idempotent
  `resolve_asset_scan`.
- `make_thumbnail` relies on `insert_derived_asset`'s existing-child idempotency rather than a
  raw pre-check select (tools reach data only through `_fn`).

## Inherited contract (all eight responsibilities still hold)

From the original spec: reference-not-bytes input (`{ assetId }`); never serve unscanned bytes
(quarantine-first); exactly one terminal verdict (`clean` promote / `infected` purge+soft-delete /
`error` leave-in-quarantine); idempotent re-runs (`storage_fn.resolve_asset_scan` guards on
`scan_status='pending'`; S3 Copy+Delete tolerates re-runs); transient-failure retry before
`error`; reads gated on `clean`; completion surfaced by UI poll; **no stranded assets** (reaper).

**Agentic addendum to the contract:** the scan verdict and the promote/purge that follows it are
computed and applied by ONE deterministic tool. The agent routes on the verdict; it can never
produce one, reorder promote-before-scan, or serve/promote bytes by any other path
(`_shared.data.md` → Deterministic-tools principle).

---

## Trigger — upload endpoint change (`packages/storage-layer/server/api/upload.post.ts`)

Identical to the n8n spec's change, retargeted:

1. The upload transaction commits the asset row (`scan_status='pending'`) — no wf calls at all.
2. **After commit**, POST to `${AGENT_INTERNAL_URL}/api/trigger/asset-scan` with the secret
   header and body `{ assetId, tenantId, aiTagsRequested }`. `202` fire-and-forget; a failed
   POST is logged and **swallowed** — the asset stays `pending` and the reaper picks it up.

The atomic-enqueue guarantee is knowingly traded for trigger + reaper coverage (Locked decision;
the reaper already owned the lost-job horizon in the old design). `ensure_asset_scan_wf` and its
deploy script retire (`decommission.data.md`).

---

## Workflow: `asset-scan` (`agent-workflows/asset-scan.ts`)

Definition: `inputSchema` `{ assetId: uuid, tenantId: uuid, aiTagsRequested: boolean }`;
`maxTurns: 12`; not singleton (concurrent scans of different assets are normal); model default.

### Toolbox

| Tool | Deterministic behavior (handler-owned) | Returns |
|---|---|---|
| `get_asset` | `storage_fn.asset_for_scan(assetId)` | `{ key, mimeType, scanStatus, tenantId, aiTagsRequested }` |
| `scan_and_resolve` | The atomic spine: S3 Get(quarantine) → `/tmp` → `clamdscan --stream` (internal transient retry: 5 tries, 30s backoff) → parse exit code (0=clean, 1=infected+signature, 2=error) → **clean:** S3 Copy(quarantine→final) + S3 Delete(quarantine) + `storage_fn.resolve_asset_scan('clean')`; **infected:** S3 Delete(quarantine) + `resolve_asset_scan('infected', signature)`; **error:** `resolve_asset_scan('error', detail)`, bytes stay in quarantine. `/tmp` cleanup in `finally`. Idempotent (resolve guards `pending`; re-call after resolution is a no-op reporting the recorded verdict) | `{ verdict: 'clean'\|'infected'\|'error', signature?, detail? }` |
| `make_thumbnail` | Guard: refuses unless the asset's `scan_status='clean'` (checked in-handler — never trusted to the agent). S3 Get(final) → `/tmp` → `ffmpeg` 256px webp → S3 Put(child key) → `storage_fn.insert_derived_asset`. `/tmp` cleanup in `finally` | `{ derivedAssetId, key }` or a tool error |
| `add_asset_tags` | `storage_fn.add_asset_tags(assetId, tags)` | `{ tags }` |
| `complete_run` | harness-injected (`_shared.data.md`) | — |

### Goal prompt (orchestration the agent owns)

> Scan uploaded asset `<assetId>`. Call `get_asset` for metadata, then `scan_and_resolve` — its
> verdict is final. If `clean`: when the MIME type is `image/*`, attempt `make_thumbnail`
> (best-effort — on failure, note it in the result and continue); when `aiTagsRequested`, call
> `add_asset_tags` with `['ai-tags-coming-soon']`. If `infected` or `error`: no further asset
> work. Always finish with `complete_run` carrying
> `{ verdict, signature?, thumbnail: 'created'|'failed'|'skipped', aiTags: 'added'|'skipped' }`.

The old fixed diamond (scan → resolve → thumbnail ∥ ai-tag → completed) becomes agent-sequenced
calls over deterministic tools. What the agent genuinely decides: branch applicability from
returned metadata, best-effort handling of thumbnail failure, and the result summary. The old
`asset-scan-completed`/`close-workflow-wf`/`wait`/`acknowledge-trigger` no-op handlers have no
analog and disappear; transient clamd retry lives inside `scan_and_resolve` (the agent may
additionally re-call it on a tool error — safe, it's idempotent).

Failure catch-all: any unhandled tool error the agent can't route around, `maxTurns`, or the
wall clock → harness `agent_fn.error_run` (`_shared.data.md` → Harness). Bytes are never
stranded mid-promotion: promotion is inside the atomic tool.

---

## Reaper (deterministic cron — NOT an agent)

Croner job in `server/plugins/agent-scheduler.ts`, cadence `$ASSET_SCAN_REAPER_CRON`:

```
storage_fn.stuck_pending_assets($ASSET_SCAN_STUCK_MINUTES, $ASSET_SCAN_MAX_WF_ATTEMPTS)
  → for each row (sequential): POST self /api/trigger/asset-scan { assetId, tenantId, aiTagsRequested }
```

- `storage_fn.stuck_pending_assets(stuck_minutes, max_attempts)` (new, `fnb-storage`): returns
  assets `scan_status='pending'` older than the threshold whose attempt count — `count(*) from
  agent.workflow_run where workflow_key='asset-scan' and input_data->>'assetId' = …` — is below
  the cap; assets at the cap are flipped to `scan_status='error'` for operator review (same
  semantics as the retired `asset-scan-reaper.ts` and the n8n spec's reaper).
- Locked decision: the reaper stays deterministic — there is no judgment in "re-fire stuck
  pending assets", so no model call is spent on it. One trigger path serves fresh and reaped
  scans.

---

## Decommissioned by this file

Handlers `scan-asset`, `resolve-asset`, `thumbnail-asset`, `ai-tag-asset`,
`asset-scan-completed`, `asset-scan-reaper`, the `clam.ts`/`ffmpeg.ts`/`s3.ts` libs (logic moves
into `agent-tools/`), the `storage_fn.ensure_asset_scan_wf` deploy script, and the
graphile-worker crontab entry — full inventory in `decommission.data.md`.
`.claude/specs/asset-storage/asset-scan-workflow.data.md` gets a superseded-by pointer to this
file (R21 propagation, README Phase 7).
