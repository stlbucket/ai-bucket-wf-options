---
name: agentic-decommission-infrastructure
description: Infrastructure deltas to run asset-scan on n8n and remove the agentic engine — the resurrected custom n8n image (ffmpeg + clamav-clients), clamav/minio wiring and the fnb-minio S3 credential, the env-var add/remove tables, the agent-app service + volume removal, and the boot order + verification after.
metadata:
  type: reference
---

## Status
**Draft.** Additive to `.claude/specs/n8n-parallel-engine/infrastructure.md` (the n8n service,
`n8n-db-init`, `n8n-import`, the credential/import loop — all stand). The subtractive half
(agent-app service, `AGENT_*` env) is cross-referenced from `decommission.data.md`; the
compose/env deltas live here so Phase 2 has one build sheet.

**Build correction 2026-07-20 (authoritative — the single-stage `apk add` design is dead):**
n8n 2.30.7 ships as a **Docker Hardened Image** (Alpine 3.24 with **`apk` removed**), on both
`docker.n8n.io/n8nio/n8n` and Docker Hub `n8nio/n8n`. `RUN apk add …` fails with exit 127. The
custom image is therefore a **multi-stage build**: install the binaries in a matching
`alpine:3.24` builder and copy them + their `ldd` shared-lib closure into the hardened image
(musl is ABI-stable across the same Alpine version). The clamdscan package is
**`clamav-clamdscan`** on Alpine (the superseded draft's `clamav-clients` is the Debian name).
Verified: the built image runs `ffmpeg -version` (8.1.2) and `clamdscan --config-file=
/etc/clamav/clamd-remote.conf …` (parses the remote config; connects to `clamav` on the network).

**Second correction 2026-07-21:** n8n 2.0 **disables the Execute Command node** (+ localFileTrigger)
by default for security ("Unrecognized node type: n8n-nodes-base.executeCommand" on workflow
activation). asset-scan runs clamdscan + ffmpeg via Execute Command, so the n8n service sets
**`NODES_EXCLUDE: "[]"`** (empty list overrides the default disable). Safe here: the commands are
fixed in the workflow JSON and `assetId` is `::uuid`-cast by the Get Asset node before Clamdscan
runs, so there is no shell-injection surface.

---

## Custom n8n image — `docker/n8n/Dockerfile` (multi-stage)

asset-scan needs binaries the hardened base lacks and cannot `apk add` (Status). Install them in
a matching Alpine builder and copy the binaries + lib closure into the hardened image:

```dockerfile
FROM alpine:3.24 AS bins
RUN apk add --no-cache ffmpeg clamav-clamdscan   # clamdscan lives in clamav-clamdscan on Alpine
RUN mkdir -p /out/bin /out/lib \
 && for b in /usr/bin/ffmpeg /usr/bin/clamdscan; do \
      cp -L "$b" /out/bin/; \
      ldd "$b" | awk '/=>/ { print $3 }' | sort -u | while read -r lib; do \
        [ -f "$lib" ] && cp -Ln "$lib" /out/lib/ 2>/dev/null || true; \
      done; \
    done

FROM docker.n8n.io/n8nio/n8n:2.30.7
USER root
COPY --from=bins /out/bin/ /usr/local/bin/
COPY --from=bins /out/lib/ /usr/local/lib/
ENV LD_LIBRARY_PATH=/usr/local/lib
COPY clamd-remote.conf /etc/clamav/clamd-remote.conf
USER node
```

`docker/n8n/clamd-remote.conf` (moved verbatim from `apps/agent-app/clamd-remote.conf`, which is
deleted with the app):
```
TCPSocket 3310
TCPAddr clamav
```

- No `gettext`/`envsubst` — credentials still render via `n8n/scripts/render-credentials.mjs`
  (node), unchanged from the parallel-engine import loop.
- Binary steps run only as **Execute Command** nodes on `/tmp` files — no
  `NODE_FUNCTION_ALLOW_BUILTIN` relaxation, no raw sockets in Code nodes.
- `docker/n8n/db-init.sh` (the existing `n8n-db-init` script) is unaffected.

---

## Compose changes (`docker-compose.yml` + `infra/compose/docker-compose.prod.yml`)

**`n8n` service** — swap `image:` for the custom build, add the asset dependencies + env:

```yaml
n8n:
  build:
    context: docker/n8n            # was: image: docker.n8n.io/n8nio/n8n:2.30.7
  depends_on:
    n8n-import:  { condition: service_completed_successfully }
    db-migrate:  { condition: service_completed_successfully }
    minio-init:  { condition: service_completed_successfully }   # asset-scan reads/moves bucket objects
    clamav:      { condition: service_started }                  # SOFT gate — node retry + reaper own the horizon
  environment:
    # …existing n8n env unchanged…
    ASSET_SCAN_MAX_WF_ATTEMPTS: "${ASSET_SCAN_MAX_WF_ATTEMPTS:?}"   # $env.* in asset-scan-reaper
    ASSET_SCAN_STUCK_MINUTES:   "${ASSET_SCAN_STUCK_MINUTES:?}"
    CLAMAV_HOST: "${CLAMAV_HOST:?}"                                 # clamd-remote.conf targets `clamav`; kept for parity
    CLAMAV_PORT: "${CLAMAV_PORT:?}"
    S3_ENDPOINT: "${S3_ENDPOINT:?}"                                 # $env.* in the asset-scan S3 nodes
    S3_BUCKET:   "${S3_BUCKET:?}"
```

- **`n8n-import`** stays on the **base pin** `docker.n8n.io/n8nio/n8n:2.30.7` (build decision
  2026-07-20): it only renders credentials + runs `import`/`publish`, needs no ffmpeg/clamav, and
  the custom image is `FROM` that exact pin so the CLI/schema versions are already identical.
  Only the **server** gets the custom `build:`.
- The `clamav` container already exists (agent-app's asset-scan used it via `clamd-remote.conf`);
  n8n reuses it — no new clamav service.
- **Remove** the `agent-app` service and the `agent-transcripts` top-level volume
  (`decommission.data.md`).
- **Prod compose** (`infra/compose/docker-compose.prod.yml`) uses pre-built **registry** images,
  so the custom n8n image there means a CI build+push to `${REGISTRY}/fnb-n8n:${IMAGE_TAG}` (like
  the app images) — folded into **Phase 4** alongside the agent-app removal + the `deploy.yml` CI
  changes, since it is entangled with the in-flight deployment effort (plan 0010). The dev
  rebuild gate uses `docker-compose.yml` only.

---

## The `fnb-minio` S3 credential (new — `n8n/credentials/fnb-minio.json.tpl`)

The parallel-engine inventory had no S3 node (no asset-scan). asset-scan's S3 Get/Put/Copy/Delete
nodes need a credential. Add a template rendered by the existing `render-credentials.mjs` loop:

```json
{
  "id": "fnbminiocred1",
  "name": "fnb-minio",
  "type": "s3",
  "data": {
    "endpoint": "${S3_ENDPOINT}",
    "region": "us-east-1",
    "accessKeyId": "${MINIO_ROOT_USER}",
    "secretAccessKey": "${MINIO_ROOT_PASSWORD}",
    "forcePathStyle": true
  }
}
```

(Confirm the exact `type`/`data` keys for the n8n S3 credential at build time via `n8n-cli` /
the editor — n8n credential schemas are version-sensitive; `postgraphile-5-expert` is not the
authority here, the `n8n-cli` skill is.) The `n8n-import` service already renders every template
in `n8n/credentials/` and gains `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` in its env.

---

## Env-var deltas

### Added / newly-consumed (by the n8n + n8n-import services)

| Var | Consumer | Purpose |
|---|---|---|
| `ASSET_SCAN_MAX_WF_ATTEMPTS` | n8n (`$env` in reaper) | reaper attempt cap — **retained** from agent-app, now read by n8n |
| `ASSET_SCAN_STUCK_MINUTES` | n8n (`$env` in reaper) | reaper stuck threshold — retained |
| `CLAMAV_HOST` / `CLAMAV_PORT` | n8n | retained; `clamd-remote.conf` already targets `clamav:3310` |
| `S3_ENDPOINT` / `S3_BUCKET` | n8n (`$env` in S3 nodes) | retained; MinIO endpoint + bucket |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | n8n-import | render the `fnb-minio` credential (already exist for `minio-init`) |

### Removed (with agent-app / Phase 4–5)

| Var | Was |
|---|---|
| `AGENT_INTERNAL_URL` | graphql-api-app + storage-app → agent trigger route |
| `AGENT_TRIGGER_SECRET` | agent trigger auth |
| `AGENT_WORKER_PG_PASSWORD` | `agent_worker` role — threaded through `scripts/db-deploy.ts` + `docker/migrate-entrypoint.sh` |
| `AGENT_MODEL_DEFAULT` | agent default model |
| `ASSET_SCAN_REAPER_CRON` | croner cadence → **baked into the `asset-scan-reaper` Schedule Trigger JSON** |

**Retained (NOT removed):** `ANTHROPIC_API_KEY` — backs the `anthropic-api-key` n8n credential.

All removals propagate to `.env`, `.env.example`, `scripts/env-build.ts` docs,
`docker-compose.yml`, `infra/compose/docker-compose.prod.yml`, and `.github/workflows/deploy.yml`
(`decommission.data.md` has the file-by-file table). `DEPLOY_PACKAGES` drops `fnb-agent`.

---

## Boot order (after)

```
db (healthy) ─▶ n8n-db-init ─▶ n8n-import ─▶ n8n (custom image; webhooks live)
     ├────────▶ db-migrate (fnb-n8n schema + n8n_worker; NO fnb-agent) ──┘
     ├────────▶ minio-init ──────────────────────────────────────────────┘
     └────────▶ clamav (soft) ───────────────────────────────────────────┘
```

An upload arriving before n8n is ready stays `scan_status='pending'` and the reaper re-fires it
(asset-scan's reaper contract) — the lost-trigger horizon is unchanged from today.

---

## Verification (read-only beyond the triggers; user runs any rebuild — memory `feedback_rebuild_ask_user`)

1. `docker compose ps` — `n8n` up on the custom image; `agent-app` gone; `n8n-db-init` /
   `n8n-import` / `minio-init` exited 0.
2. `docker compose exec n8n which clamdscan ffmpeg` → both present; `clamdscan --version` talks to
   the `clamav` container via `clamd-remote.conf`.
3. `n8n-cli workflow list` shows `asset-scan`, `asset-scan-reaper` (active), plus the migrated
   `sync-breweries` / `sync-airports` / `exerciser`, `game-event`, `error-handler`.
4. Upload an image → `n8n.workflow_run` row for `asset-scan` → `success`; quarantine object
   purged, final object present, webp thumbnail child created.
5. Upload the EICAR test string → verdict `infected`; quarantine deleted, asset soft-deleted, run
   `success` with `result_data.verdict='infected'`.
6. Backdate a `pending` asset → the reaper's Schedule Trigger re-fires it on the next tick
   (`n8n.workflow_run` attempt count climbs; at-cap → `scan_status='error'`).
7. `psql function_bucket` as `n8n_worker` executes `storage_fn.asset_for_scan` /
   `resolve_asset_scan` / `stuck_pending_assets` and **cannot** SELECT `storage.asset` directly.
8. No agent-app: `curl` to any old `AGENT_INTERNAL_URL` route fails (service gone); the stack is
   otherwise healthy.
