---
name: n8n-workflow-engine-infrastructure
description: Docker/compose infrastructure for the self-hosted n8n engine — custom image, n8n_engine database init, import job, service definition, env vars, and boot order.
metadata:
  type: reference
---

## Status
Draft — locked decisions in `README.md`; no `[FILL IN]` markers remain.

---

## Services (docker-compose.yml)

Three additions, following house one-shot precedents (`minio-init`, `zitadel-init`/`zitadel-seed`):

### 1. `n8n-db-init` (one-shot)

Creates the **`n8n_engine` database** and its owner login role inside the existing postgis
container. Image: `postgis/postgis` (has `psql`) or `alpine` + `postgresql-client`, matching the
`db-migrate` approach. Idempotent SQL:

```sql
-- run against the postgres maintenance DB as the superuser
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'n8n_engine') THEN
    EXECUTE format('CREATE ROLE n8n_engine LOGIN PASSWORD %L', :'pw');
  END IF;
END $$;
-- CREATE DATABASE cannot run in DO; guard with gexec or `psql -c` + `|| true` on 42P04
CREATE DATABASE n8n_engine OWNER n8n_engine;  -- skip if exists
```

`depends_on: db (service_healthy)`. The `n8n_worker` role in `function_bucket` is **not**
created here — it belongs to the `db/fnb-n8n` sqitch package (`_shared.data.md`).

### 2. `n8n-import` (one-shot)

Runs the workflow-as-code import **before the server starts** (CLI writes straight to
`n8n_engine`; no API key needed):

```sh
for t in /import/credentials/*.json.tpl; do envsubst < "$t" > "/tmp/creds/$(basename "${t%.tpl}")"; done
n8n import:credentials --separate --input=/tmp/creds
n8n import:workflow  --separate --input=/import/workflows
```

- Image: the same custom n8n image as the server (below) — guarantees CLI/schema version match.
- Mounts: `./n8n/workflows:/import/workflows:ro`, `./n8n/credentials:/import/credentials:ro`.
- `depends_on: n8n-db-init (service_completed_successfully)`.
- Needs the same `DB_*` + `N8N_ENCRYPTION_KEY` env as the server (credentials are encrypted with
  this key at import time) plus every `${…}` the credential templates reference
  (`N8N_WORKER_PG_PASSWORD`, `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`, `N8N_WEBHOOK_SECRET`).

### 3. `n8n` (the engine)

```yaml
n8n:
  build:
    context: docker/n8n            # custom image — see below
  container_name: fnb_n8n
  networks: [fnb-network]
  depends_on:
    n8n-import:
      condition: service_completed_successfully
    db-migrate:
      condition: service_completed_successfully   # fnb-n8n schema must exist before first run
    minio-init:
      condition: service_completed_successfully   # asset-scan reads/moves bucket objects
    clamav:
      condition: service_started                  # SOFT gate — node retry + reaper own the horizon
  environment:
    DB_TYPE: postgresdb
    DB_POSTGRESDB_HOST: db
    DB_POSTGRESDB_PORT: "5432"
    DB_POSTGRESDB_DATABASE: n8n_engine
    DB_POSTGRESDB_USER: n8n_engine
    DB_POSTGRESDB_PASSWORD: "${N8N_ENGINE_DB_PASSWORD:?}"
    N8N_ENCRYPTION_KEY: "${N8N_ENCRYPTION_KEY:?}"
    N8N_PORT: "5678"
    N8N_LISTEN_ADDRESS: 0.0.0.0
    WEBHOOK_URL: "http://localhost:${N8N_HOST_PORT:?}/"   # editor-displayed URLs only; internal callers use N8N_INTERNAL_URL
    N8N_DIAGNOSTICS_ENABLED: "false"
    N8N_PERSONALIZATION_ENABLED: "false"
    N8N_RUNNERS_ENABLED: "true"                  # current-gen task runners for Code nodes
    GENERIC_TIMEZONE: "${TZ:-UTC}"
    # workflow tunables read via $env.* expressions inside workflows:
    ASSET_SCAN_MAX_WF_ATTEMPTS: "${ASSET_SCAN_MAX_WF_ATTEMPTS:?}"
    ASSET_SCAN_STUCK_MINUTES: "${ASSET_SCAN_STUCK_MINUTES:?}"
    CLAMAV_HOST: "${CLAMAV_HOST:?}"
    CLAMAV_PORT: "${CLAMAV_PORT:?}"
    S3_ENDPOINT: "${S3_ENDPOINT:?}"
    S3_BUCKET: "${S3_BUCKET:?}"
  ports:
    - "${N8N_HOST_PORT:?}:5678"                  # editor + webhooks (ZITADEL own-port precedent)
  volumes:
    - n8n-data:/home/node/.n8n                   # instance settings; state of record is n8n_engine
  restart: unless-stopped
```

The reaper cadence (`ASSET_SCAN_REAPER_CRON`) lives **inside** the `asset-scan-reaper` workflow's
Schedule Trigger (definitions are code; changing cadence = edit + re-import), so that env var
retires. `worker-app`'s service block, Dockerfile, and its whole env set are removed
(`decommission.data.md`).

---

## Custom image — `docker/n8n/Dockerfile`

The asset pipeline needs binaries the stock image lacks:

```dockerfile
FROM docker.n8n.io/n8nio/n8n:<PINNED>   # pin latest stable at implementation (zitadel precedent)
USER root
RUN apk add --no-cache ffmpeg clamav-clients gettext   # gettext → envsubst for n8n-import
COPY clamd-remote.conf /etc/clamav/clamd-remote.conf   # TCPAddr/TCPSocket → clamav container
USER node
```

`clamd-remote.conf`:
```
TCPSocket 3310
TCPAddr clamav
```

Binary-heavy steps run as **Execute Command** nodes on files under `/tmp` (`clamdscan
--config-file=/etc/clamav/clamd-remote.conf --stream`, `ffmpeg`) — no
`NODE_FUNCTION_ALLOW_BUILTIN` relaxation, no raw sockets in Code nodes
(README → Considered & rejected).

---

## Env vars (added to `.env` / `scripts/env-build.ts` flow)

| Var | Consumer | Purpose |
|---|---|---|
| `N8N_HOST_PORT` | compose | host port for editor + webhooks (e.g. `5678`) |
| `N8N_ENGINE_DB_PASSWORD` | n8n-db-init, n8n, n8n-import | `n8n_engine` role password |
| `N8N_ENCRYPTION_KEY` | n8n, n8n-import | n8n credential-store key (stable across rebuilds) |
| `N8N_WORKER_PG_PASSWORD` | sqitch deploy (fnb-n8n), n8n-import | `n8n_worker` role in `function_bucket` |
| `N8N_WEBHOOK_SECRET` | n8n-import, graphql-api-app, storage-app | shared webhook header secret |
| `N8N_INTERNAL_URL` | graphql-api-app, storage-app | `http://n8n:5678` — compose-internal webhook base |

Removed with worker-app: `ASSET_SCAN_REAPER_CRON` (moves into the reaper workflow JSON).
Retained (now consumed by the n8n service): `ASSET_SCAN_MAX_WF_ATTEMPTS`,
`ASSET_SCAN_STUCK_MINUTES`, `CLAMAV_HOST`, `CLAMAV_PORT`, S3 vars.

---

## Editor access & operator workflow (dev)

- Editor at `http://localhost:${N8N_HOST_PORT}`. First visit creates the owner account —
  manual, dev-only (same trust level as the ZITADEL console; no nginx exposure, not part of the
  app's URL space, no ZITADEL SSO wiring in scope).
- `n8n-cli` (the operator skill/tool) targets the same instance: `N8N_URL=http://localhost:${N8N_HOST_PORT}`
  + an API key generated in the editor. Used for the export-to-repo loop
  (`n8n-cli workflow get <id> --json > n8n/workflows/<key>.json`), never by app code.
- nginx: **no location block** — n8n is not routed through the app entry point.

---

## Boot order (replaces worker-app's slot)

```
db (healthy) ─▶ n8n-db-init ─▶ n8n-import ─▶ n8n (webhooks live)
     └────────▶ db-migrate (fnb-n8n schema + n8n_worker role) ──┘
```

Upload-before-n8n-ready is tolerated by design: the asset stays `scan_status='pending'` and the
reaper re-fires it (`asset-scan.workflow.data.md` → Reaper).

---

## Verification (read-only; user runs any rebuild — memory `feedback_rebuild_ask_user`)

1. `docker compose ps` — `n8n` healthy; `n8n-db-init`/`n8n-import` exited 0.
2. `n8n-cli workflow list` shows the five workflows, webhook/cron ones active.
3. `curl -X POST -H "X-Fnb-Webhook-Secret: …" http://localhost:$N8N_HOST_PORT/webhook/exerciser` → 200,
   a `n8n.workflow_run` row appears and completes.
4. Wrong/missing secret → 403 from n8n.
5. `psql function_bucket` as `n8n_worker` can execute granted fns and **cannot** select from
   arbitrary tables (spot-check `app.profile`).
