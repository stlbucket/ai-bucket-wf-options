---
name: n8n-parallel-engine-infrastructure
description: Docker/compose infrastructure for the parallel n8n engine — official pinned image, n8n_engine database init, workflow/credential import job, service definition, env vars, boot order, and infra verification.
metadata:
  type: reference
---

## Status
**Implemented 2026-07-19** — image pinned `docker.n8n.io/n8nio/n8n:2.30.7`. Corrections from
the build (authoritative where they differ from the body below):
- `docker/n8n/db-init.sh` feeds the `ALTER ROLE … PASSWORD :'pw'` through **stdin** — psql
  substitutes `:'var'` only in stdin/`-f` input, never `-c` strings (failed live with a syntax
  error on first boot).
- The `n8n` healthcheck probes **`http://127.0.0.1:5678/healthz`**, not `localhost` — the
  alpine image resolves `localhost` to `::1` first and n8n listens IPv4-only (container showed
  `unhealthy` while fully working).
- The import one-shot ends with a **per-workflow `n8n publish:workflow --id=…` loop**:
  `import:workflow` force-deactivates everything it imports and n8n 2.x retired
  `update:workflow --all`. Without this, a rebuild boots with dead webhooks and an inactive
  error-handler (which n8n 2.x refuses to invoke).

> Adapted from the superseded `.claude/specs/n8n-workflow-engine/infrastructure.md` for the
> coexistence scope: **official image (no custom Dockerfile)**, no clamav/minio coupling, no
> asset-scan tunables. Nothing existing is removed — agent-app and its whole env set stay.

---

## Services (docker-compose.yml)

Three additions, following house one-shot precedents (`minio-init`, `zitadel-init`):

### 1. `n8n-db-init` (one-shot)

Creates the **`n8n_engine` database** and its owner login role inside the existing postgis
container. Image: `postgis/postgis` (has `psql`), matching the `db-migrate` approach.
Idempotent; `depends_on: db (service_healthy)`:

```sql
-- against the postgres maintenance DB as the superuser
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'n8n_engine') THEN
    CREATE ROLE n8n_engine LOGIN;
  END IF;
END $$;
ALTER ROLE n8n_engine PASSWORD :'n8n_engine_db_password';
-- CREATE DATABASE cannot run in DO; guard via `psql -tc "SELECT 1 FROM pg_database …" | grep -q 1 ||`
CREATE DATABASE n8n_engine OWNER n8n_engine;
```

The `n8n_worker` role in `function_bucket` is **not** created here — it belongs to the
`db/fnb-n8n` sqitch package (`_shared.data.md`).

### 2. `n8n-import` (one-shot)

Runs the workflow-as-code import **before the server starts** (the n8n CLI writes straight to
`n8n_engine`; no API key needed). Image: the **same official pinned n8n image** as the server
(CLI/schema version match). The stock image has no `gettext`, so credential templates render
with the image's own node:

```sh
node /import/scripts/render-credentials.mjs   # ${ENV_VAR} substitution: /import/credentials/*.json.tpl → /tmp/creds/*.json
n8n import:credentials --separate --input=/tmp/creds
n8n import:workflow  --separate --input=/import/workflows
```

- Mounts (ro): `./n8n/workflows:/import/workflows`, `./n8n/credentials:/import/credentials`,
  `./n8n/scripts:/import/scripts`.
- `depends_on: n8n-db-init (service_completed_successfully)`.
- Env: the same `DB_*` + `N8N_ENCRYPTION_KEY` as the server (credentials are encrypted with this
  key at import time) plus every `${…}` the templates reference (`N8N_WORKER_PG_PASSWORD`,
  `N8N_WEBHOOK_SECRET`).
- Import is idempotent (stable workflow ids overwrite in place) — the n8n analog of the
  sqitch/seed rebuild loop.

### 3. `n8n` (the engine)

```yaml
n8n:
  image: docker.n8n.io/n8nio/n8n:<PINNED>        # resolve latest stable at implementation (zitadel precedent)
  container_name: fnb_n8n
  networks: [fnb-network]
  depends_on:
    n8n-import:
      condition: service_completed_successfully
    db-migrate:
      condition: service_completed_successfully   # fnb-n8n schema + n8n_worker must exist before first run
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
    N8N_RUNNERS_ENABLED: "true"
    GENERIC_TIMEZONE: "${TZ:-UTC}"
  ports:
    - "${N8N_HOST_PORT:?}:5678"                  # editor + webhooks (ZITADEL own-port precedent)
  volumes:
    - n8n-data:/home/node/.n8n                   # instance settings; state of record is n8n_engine
  restart: unless-stopped
```

Plus volume `n8n-data` in the top-level `volumes:` block.

**Existing services touched (env only):**
- `graphql-api-app`: add `N8N_INTERNAL_URL` (`http://n8n:5678`) + `N8N_WEBHOOK_SECRET`
  (consumed by the trigger-plugin registry's n8n branch).
- `tenant-app`: add `NUXT_PUBLIC_N8N_EDITOR_URL` (`http://localhost:${N8N_HOST_PORT}`) — the
  site-admin n8n page's editor link-out (`''` sentinel in `nuxt.config.ts` `runtimeConfig.public`).

No custom Dockerfile (locked): demo scope has no binary steps. If a workflow needing
ffmpeg/clamav ever moves to n8n, resurrect `docker/n8n/Dockerfile` from the superseded spec.

---

## Repo layout (new top-level `n8n/` dir)

```
n8n/
├── workflows/
│   ├── error-handler.json          # exported via n8n-cli after editor build (Phase 3)
│   └── n8n-exerciser.json
├── credentials/
│   ├── fnb-n8n-worker.json.tpl     # PG credential: db/function_bucket as n8n_worker, ${N8N_WORKER_PG_PASSWORD}
│   └── fnb-webhook-secret.json.tpl # Header Auth: X-Fnb-Webhook-Secret = ${N8N_WEBHOOK_SECRET}
└── scripts/
    └── render-credentials.mjs      # ${ENV_VAR} substitution (node, no gettext dependency)
```

Naming: workflow `name` = workflow key; webhook `path` = workflow key. Rendered credential
files are never written to the repo; secrets exist only in env + n8n's encrypted store.

---

## Env vars (added to `.env` / `.env.example` / `scripts/env-build.ts` docs)

| Var | Consumer | Purpose |
|---|---|---|
| `N8N_HOST_PORT` | compose | host port for editor + webhooks (e.g. `5678`) |
| `N8N_ENGINE_DB_PASSWORD` | n8n-db-init, n8n, n8n-import | `n8n_engine` role password |
| `N8N_ENCRYPTION_KEY` | n8n, n8n-import | n8n credential-store key (stable across rebuilds) |
| `N8N_WORKER_PG_PASSWORD` | sqitch deploy (fnb-n8n), n8n-import | `n8n_worker` role in `function_bucket` (threaded like `AGENT_WORKER_PG_PASSWORD`) |
| `N8N_WEBHOOK_SECRET` | n8n-import, graphql-api-app | shared webhook header secret |
| `N8N_INTERNAL_URL` | graphql-api-app | `http://n8n:5678` — compose-internal webhook base |
| `NUXT_PUBLIC_N8N_EDITOR_URL` | tenant-app | editor link-out on the site-admin n8n page |

Nothing removed — all agent/`AGENT_*` vars stay exactly as they are.

---

## Editor access & operator workflow (dev)

- Editor at `http://localhost:${N8N_HOST_PORT}`. First visit creates the owner account —
  manual, dev-only (ZITADEL-console trust level; no nginx exposure, no SSO wiring in scope).
- `n8n-cli` (operator skill) targets the same instance: `N8N_URL=http://localhost:${N8N_HOST_PORT}`
  + an API key generated in the editor. Used for the export-to-repo loop
  (`n8n-cli workflow get <id> --json > n8n/workflows/<key>.json`), never by app code.
- **A full rebuild wipes `n8n_engine`** — owner account AND editor-issued API keys are gone
  (the import one-shot re-migrates from scratch; a stale `N8N_API_KEY` in `.env` then 401s
  even though its JWT hasn't expired). After each full rebuild: redo owner setup, mint a new
  key, update `.env`. Repo-JSON edits + rebuild are therefore the reliable workflow-change
  path; the live API is a convenience that dies with the volume (lesson 2026-07-20).
- nginx: **no location block**.

---

## Boot order (additive — nothing existing moves)

```
db (healthy) ─▶ n8n-db-init ─▶ n8n-import ─▶ n8n (webhooks live)
     └────────▶ db-migrate (fnb-n8n schema + n8n_worker role) ──┘
```

A trigger arriving before n8n is ready gets a failed POST; the plugin surfaces
`workflow trigger failed` as a GraphQL error (demo workflows have no reaper contract — acceptable).

---

## Verification (read-only; user runs any rebuild — memory `feedback_rebuild_ask_user`)

1. `docker compose ps` — `n8n` up; `n8n-db-init`/`n8n-import` exited 0.
2. Editor reachable on `http://localhost:$N8N_HOST_PORT`; owner-account setup done by the user.
3. `n8n-cli workflow list` shows `error-handler` + `n8n-exerciser`, webhook workflow active.
4. `curl -X POST -H "X-Fnb-Webhook-Secret: …" http://localhost:$N8N_HOST_PORT/webhook/n8n-exerciser`
   → 200; a `n8n.workflow_run` row appears and completes.
5. Wrong/missing secret → 403 from n8n.
6. `psql function_bucket` as `n8n_worker` can execute `n8n_fn.*` + `app_api.raise_exception` and
   **cannot** select from arbitrary tables (spot-check `app.profile`).
7. Agentic engine untouched: agent-app healthy, an upload still scans, `docker compose ps` diff
   shows only the three new services.
