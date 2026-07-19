---
name: agentic-workflow-engine-infrastructure
description: Docker/compose infrastructure for the agentic workflow engine — the headless agent-app service, custom image (ffmpeg + clamdscan), env vars, boot order, and infra verification.
metadata:
  type: reference
---

## Status
**Implemented 2026-07-17.** Corrections from the build:

- Alpine's clamdscan package is **`clamav-clamdscan`** (`clamav-clients` is the Debian name) —
  the Dockerfile installs `ffmpeg clamav-clamdscan`.
- The dev-mode compose service follows the house dev pattern on top of the block below:
  bind mount `.:/app`, `node_modules_root` + `node_modules_agent_app` volumes, `pnpm-install` +
  `packages-watch` depends, `pnpm --filter … exec nuxt dev` command; the S3 env uses the
  `S3_ACCESS_KEY: ${MINIO_ROOT_USER:?}` aliasing like every other service.
- `AGENT_WORKER_PG_PASSWORD` is also passed to **db-migrate** (sqitch `--set` — see
  `_shared.data.md` → Implementation notes).
- The SDK smoke test is `GET /api/dev/sdk-smoke` (dev-only, trigger-only — never a boot hook,
  which would spend a model call per hot reload); run it via
  `docker exec fnb_agent_app wget -qO- http://127.0.0.1:3000/api/dev/sdk-smoke` (IPv4 —
  in-container `localhost` resolves to `::1` first and the server binds 0.0.0.0).

---

## Services (docker-compose.yml)

**One addition** — no new database, no init/import one-shots (contrast: the n8n spec needs
`n8n-db-init` + `n8n-import` + a second database). agent-app slots into worker-app's place.

### `agent-app` (the engine)

```yaml
agent-app:
  build:
    context: .
    dockerfile: apps/agent-app/Dockerfile      # custom image — see below
  container_name: fnb_agent_app
  networks: [fnb-network]
  depends_on:
    db-migrate:
      condition: service_completed_successfully  # fnb-agent schema + agent_worker role must exist
    minio-init:
      condition: service_completed_successfully  # asset-scan reads/moves bucket objects
    clamav:
      condition: service_started                 # SOFT gate — tool retry + reaper own the horizon
  environment:
    NUXT_PORT: "3000"
    ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY:?}"
    AGENT_MODEL_DEFAULT: "${AGENT_MODEL_DEFAULT:-claude-haiku-4-5}"
    AGENT_TRIGGER_SECRET: "${AGENT_TRIGGER_SECRET:?}"
    AGENT_WORKER_PG_PASSWORD: "${AGENT_WORKER_PG_PASSWORD:?}"
    AGENT_RUN_TIMEOUT_MINUTES: "${AGENT_RUN_TIMEOUT_MINUTES:-15}"
    PGHOST: db
    PGPORT: "5432"
    PGDATABASE: function_bucket                # pool connects as agent_worker (tools only)
    # workflow tunables (reaper + asset-scan):
    ASSET_SCAN_REAPER_CRON: "${ASSET_SCAN_REAPER_CRON:?}"   # retained (unlike the n8n spec)
    ASSET_SCAN_MAX_WF_ATTEMPTS: "${ASSET_SCAN_MAX_WF_ATTEMPTS:?}"
    ASSET_SCAN_STUCK_MINUTES: "${ASSET_SCAN_STUCK_MINUTES:?}"
    CLAMAV_HOST: "${CLAMAV_HOST:?}"
    CLAMAV_PORT: "${CLAMAV_PORT:?}"
    S3_ENDPOINT: "${S3_ENDPOINT:?}"
    S3_BUCKET: "${S3_BUCKET:?}"
    MINIO_ROOT_USER: "${MINIO_ROOT_USER:?}"
    MINIO_ROOT_PASSWORD: "${MINIO_ROOT_PASSWORD:?}"
  volumes:
    - agent-transcripts:/data/transcripts       # per-run JSONL — the deep step-level record
  restart: unless-stopped
```

- **Headless like worker-app**: no nginx location, no `NUXT_APP_BASE_URL`, no layers, no pages.
  It *does* listen on `:3000` compose-internal — `graphql-api-app` and `storage-app` reach it at
  `AGENT_INTERNAL_URL=http://agent-app:3000`. No host port by default (add one temporarily for
  curl-debugging if wanted; triggers are secret-gated either way).
- `worker-app`'s service block, Dockerfile, and its whole env set are removed
  (`decommission.data.md`).
- `packages-watch` interaction: agent-app consumes no fnb workspace packages beyond `fnb-types`
  (tools are self-contained; no db-access/graphql-client-api dependency) — it joins the normal
  app build path, nothing new in the healthcheck.

---

## Custom image — `apps/agent-app/Dockerfile`

The asset pipeline needs binaries the stock node image lacks (worker-app precedent — its
ffmpeg-bearing Dockerfile role moves here):

```dockerfile
# same node/pnpm base + build stages as the other apps (fnb-create-app skeleton)
# ...
RUN apk add --no-cache ffmpeg clamav-clients
COPY apps/agent-app/clamd-remote.conf /etc/clamav/clamd-remote.conf
```

`clamd-remote.conf`:
```
TCPSocket 3310
TCPAddr clamav
```

`clamdscan --config-file=/etc/clamav/clamd-remote.conf --stream` and `ffmpeg` run as child
processes **inside tool handlers only** (`agent-tools/`) — the model has no Bash/Execute tool
(`_shared.data.md` → Security model).

---

## Env vars (added to `.env` / `scripts/env-build.ts` flow)

| Var | Consumer | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | agent-app | Claude Agent SDK auth |
| `AGENT_MODEL_DEFAULT` | agent-app | default model for runs (`claude-haiku-4-5`); per-definition override in code |
| `AGENT_TRIGGER_SECRET` | agent-app, graphql-api-app, storage-app | shared trigger header secret |
| `AGENT_INTERNAL_URL` | graphql-api-app, storage-app | `http://agent-app:3000` — compose-internal trigger base |
| `AGENT_WORKER_PG_PASSWORD` | sqitch deploy (fnb-agent), agent-app | `agent_worker` role in `function_bucket` |
| `AGENT_RUN_TIMEOUT_MINUTES` | agent-app | harness wall-clock cap per run (default 15) |

Retained (consumer moves from worker-app to agent-app): `ASSET_SCAN_REAPER_CRON`,
`ASSET_SCAN_MAX_WF_ATTEMPTS`, `ASSET_SCAN_STUCK_MINUTES`, `CLAMAV_HOST`, `CLAMAV_PORT`, S3 vars.
(The n8n spec retires `ASSET_SCAN_REAPER_CRON` into workflow JSON; here the croner schedule
reads it — env stays the tuning surface.)

`DEPLOY_PACKAGES`: remove `fnb-wf`, add `fnb-agent` (slot after `fnb-app`; `fnb-storage` no
longer needs the "fnb-wf must precede" rule).

---

## Boot order (replaces worker-app's slot)

```
db (healthy) ─▶ db-migrate (fnb-agent schema + agent_worker role) ─▶ agent-app (triggers live)
                minio-init ────────────────────────────────────────┘
```

Upload-before-agent-app-ready is tolerated by design: the asset stays `scan_status='pending'`
and the reaper re-fires it (`asset-scan.workflow.data.md` → Reaper). Same trade as the n8n spec.

---

## Operator surface (dev)

- No editor equivalent — definitions are code; "edit a workflow" = edit
  `apps/agent-app/server/lib/agent-workflows/<key>.ts`, rebuild.
- Debugging a run: `agent.workflow_run` row (status/result/error/usage) → transcript
  `docker exec fnb_agent_app cat /data/transcripts/<runId>.jsonl` for the step-level record.
- Manual trigger: `curl -X POST -H "X-Fnb-Trigger-Secret: …" -H 'content-type: application/json'
  -d '{…}' http://localhost:<temp-mapped-port>/api/trigger/<key>` (or exec a curl inside the
  network).

---

## Verification (read-only; user runs any rebuild — memory `feedback_rebuild_ask_user`)

1. `docker compose ps` — `agent-app` healthy; `db-migrate` exited 0 with `fnb-agent` deployed.
2. Trigger `exerciser` with the secret → `202 { accepted, runId }`; the `agent.workflow_run` row
   completes with populated `result_data`, `usage`, `model`; a transcript file exists.
3. Wrong/missing secret → 401; unknown key → 404; malformed body → 400 with zod issues.
4. `psql function_bucket` as `agent_worker` can execute granted fns and **cannot** select from
   arbitrary tables (spot-check `app.profile`).
5. Kill-switch sanity: a run that exceeds `maxTurns` or the wall clock lands as
   `status='error'` with the reason in `error` (exerciser can force this — see its spec).
