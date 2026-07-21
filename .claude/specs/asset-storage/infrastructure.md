# Asset Storage — Infrastructure (MinIO + ClamAV)

> **Engine superseded:** `apps/worker-app` (and the later agentic `apps/agent-app`) are retired —
> the scan pipeline (S3 download/upload/delete, clamdscan, ffmpeg) runs as **n8n** Execute Command
> + S3 nodes on the custom n8n image (R22; `.claude/specs/agentic-decommission/infrastructure.md`
> for the compose service, custom image, and env). worker-app/agent-app mentions below are historical.


> **URN stacking v2 (2026-07-10):** `storage.asset.context` (+ the `asset_context` enum) and
> `owning_entity_id` are **removed** — `subject_urn` is the only attach mechanism. Upload takes an
> optional `subjectUrn` form field (no `context`/`owningEntityId`); per-subject reads are
> `assetsBySubject` / `publicAssetsForSubjectList(_subjectUrn)` via `useSubjectAssets(subjectUrn)`;
> the quarantine key is `quarantine/{tenantId}/{subjectSeg}/{assetId}.{ext}`. Authoritative
> contract: `.claude/specs/urn-registry/stacking-v2.data.md`. `context`/`owning_entity_id`
> mentions below are historical.

## Status
Implemented (Phases 1–10 + final-eval Plans A/C/D, 2026-07-06/07). This file is kept true to the
running compose topology; the checklist in §6 records the landed state.

**v2 (2026-07-06 spec / 2026-07-07 implemented) — image processing:** worker-app got a **dedicated
Dockerfile with ffmpeg** (§3a). **Implemented 2026-07-07** — `apps/worker-app/Dockerfile` created,
`docker-compose.yml` `worker-app.build.dockerfile` repointed; user rebuilt (`ffmpeg -version`
available in the container). Sections marked **(v2 draft)**. Driven by
`.claude/issues/addressed/0350__storage___asset-image-thumbnails__________LOW__.plan.md`.

This file answers **"how is MinIO incorporated?"**, **"how is ClamAV included?"**, and **"how is
`storage-app` wired in?"** — the docker services, volumes, environment, healthchecks, bucket
bootstrap, nginx routing, and npm dependencies. It extends `monorepo-bootstrap-pattern.md`, which
covers the existing compose topology.

The DB module deployed here is **`fnb-storage`** (see `_shared.data.md`). Revised 2026-07-06: the
upload endpoint lives in **`storage-app`** (extending `packages/storage-layer`), so this file also
covers that app's compose service and the nginx `location /storage` block. Revised again 2026-07-06
(final-eval Plan D): the **scan worker moved to `apps/worker-app`** — a headless compose service
that is the stack's single graphile-worker migrator + runner (no nginx entry, no UI). ClamAV now
touches only worker-app; storage-app keeps S3 for the upload PutObject only.

---

## 1. MinIO (object storage)

### Why MinIO
S3-compatible, self-hosted, runs in one container. Uses the AWS SDK (`@aws-sdk/client-s3`) so the
same code works against real S3 in production by swapping the endpoint/credentials.

### 1a. Compose service (`docker-compose.yml`)

Add to the top-level `volumes:` block:
```yaml
  minio-data:
```

Add the service:
```yaml
  minio:
    image: minio/minio:RELEASE.2025-09-07T16-13-09Z   # pinned 2026-07-07 (was :latest)
    container_name: fnb_minio
    networks:
      - fnb-network
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: "${MINIO_ROOT_USER:-fnbminio}"          # dev default (Q2 resolved); prod secret TBD
      MINIO_ROOT_PASSWORD: "${MINIO_ROOT_PASSWORD:-fnbminio123}" # dev default (Q2 resolved); prod secret TBD
    ports:
      - "9000:9000"     # S3 API
      - "9001:9001"     # web console (http://localhost:9001)
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD-SHELL", "mc ready local || curl -f http://localhost:9000/minio/health/live || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 15s
```

### 1b. Bucket bootstrap (`minio-init` service)

MinIO does not auto-create buckets. Add a one-shot `mc` service that waits for MinIO to be healthy,
then creates the bucket idempotently:

```yaml
  minio-init:
    image: minio/mc:RELEASE.2025-08-13T08-35-41Z
    container_name: fnb_minio_init
    networks:
      - fnb-network
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 $$MINIO_ROOT_USER $$MINIO_ROOT_PASSWORD &&
      mc mb --ignore-existing local/${S3_BUCKET:-fnb-assets} &&
      mc anonymous set download local/${S3_BUCKET:-fnb-assets}/public &&
      echo 'bucket ready (public/ prefix anon-readable)';
      "
    environment:
      MINIO_ROOT_USER: "${MINIO_ROOT_USER:-fnbminio}"
      MINIO_ROOT_PASSWORD: "${MINIO_ROOT_PASSWORD:-fnbminio123}"
    restart: "no"
```

Alternative (not chosen): create-bucket-if-missing inside the endpoint on first request. The `mc`
service is preferred — explicit, out of the request path, and visible in compose.

### 1c. Object key layout (quarantine-first)

- Initial (all uploads): `quarantine/[tenant_id]/[context]/[owning_entity_id]/[asset_uuid].[extension]`
- Final (after a clean verdict): `[public|private]/[tenant_id]/[context]/[owning_entity_id]/[asset_uuid].[extension]`

(see `_shared.data.md` / `endpoint.data.md` for the formulas and the `no_context` fallback; the
`asset-scan` workflow performs the move — `asset-scan-workflow.data.md`).

- **Leading `public`/`private` segment** drives visibility: `mc anonymous set download .../public`
  makes only the `public/*` prefix anonymously downloadable; `private/*` stays locked and is served
  via presigned GET. Public downloads therefore need no signing. **`quarantine/*` never gets any
  policy** and no presigned URL is ever minted for it (`downloadUrl` is null while pending).
- `minio-init` adds an `mc ilm` lifecycle rule expiring `quarantine/*` objects older than 7 days
  (orphan cleanup + terminal-`error` review window — see `asset-scan-workflow.data.md`); guarded
  by an `ilm rule ls | grep` check so re-runs don't stack duplicate rules.
- `tenant_id` from `claims.tenantId` — partitions objects per tenant.
- On-disk name is **`[asset_uuid].[extension]`** — never the original filename (collision-, traversal-,
  and enumeration-safe). `original_name` lives in the DB and is restored on download via
  `ResponseContentDisposition` (see `graphql.data.md`).
- Bucket: **`fnb-assets`** (single bucket; tenant isolation is by key prefix + DB RLS, **not** bucket ACLs).
- Default visibility is **private**: objects under `private/*` are only reachable via the presigned
  GET minted by the GraphQL `downloadUrl` field. The **only** anonymous policy is the
  `mc anonymous set download` on the `public/*` prefix (1b) — never a bucket-wide public policy.

### 1d. Env — split between three apps (and `.env.example`)

The same `S3_*` keys go to three services with distinct uses: **`storage-app`** (PutObject at
upload only), **`worker-app`** (GetObject/CopyObject/DeleteObject in the scan workflow), and
**`graphql-api-app`** (**presigning only** — the `downloadUrl` field, a local HMAC, no S3 calls,
no writes):

```yaml
      # storage-app, worker-app AND graphql-api-app environment blocks:
      S3_ENDPOINT: "http://minio:9000"       # server-side SDK
      S3_PUBLIC_BASE_URL: "http://localhost:9000/fnb-assets"  # browser-reachable base for public/ objects (dev; CDN in prod)
      S3_REGION: "us-east-1"                 # arbitrary for MinIO; SDK requires a value
      S3_BUCKET: "fnb-assets"
      S3_ACCESS_KEY: "${MINIO_ROOT_USER:-fnbminio}"
      S3_SECRET_KEY: "${MINIO_ROOT_PASSWORD:-fnbminio123}"
      S3_FORCE_PATH_STYLE: "true"            # required for MinIO
```
Mirror the keys (values blank) into `.env.example`.

### 1e. S3 client (storage-layer + graphql-api-app)

```ts
import { S3Client } from '@aws-sdk/client-s3'
export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',   // MinIO needs path-style
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
})
```
Instantiate once as a module-level singleton (not per request). Three copies of this ~15-line file:
`packages/storage-layer/server/lib/s3.ts` (upload PutObject),
`apps/worker-app/server/lib/s3.ts` (scan Get/Copy/Delete), and
`apps/graphql-api-app/server/lib/s3.ts` (presign only) — deliberate small duplication.

---

## 2. ClamAV (malware scanning)

### Why ClamAV
Open-source AV daemon (`clamd`) reachable over TCP on port 3310. The Node client `clamscan` speaks
the clamd protocol; the **`scan-asset` workflow handler** (in worker-app) streams the
quarantined object's bytes to it and gets back clean/infected + the matched signature name.
**Asynchronous** per the locked decision (quarantine-first): the upload request never touches
clamd; unscanned bytes sit in `quarantine/` — unreachable — until the verdict.

### 2a. Compose service (`docker-compose.yml`)

Add to top-level `volumes:`:
```yaml
  clamav-db:
```

Add the service:
```yaml
  clamav:
    image: clamav/clamav:1.5.3       # pinned 2026-07-07; bundles clamd + freshclam
    container_name: fnb_clamav
    networks:
      - fnb-network
    ports:
      - "3310:3310"                  # clamd TCP (host-exposed for debugging; optional)
    volumes:
      - clamav-db:/var/lib/clamav    # persist the virus signature DB across restarts
    healthcheck:
      test: ["CMD-SHELL", "clamdcheck.sh || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 12
      start_period: 180s             # first boot downloads/loads signatures — SLOW (~1-3 min)
```

**Important:** ClamAV's first start runs `freshclam` to fetch the signature database and then loads
it into `clamd` — this can take 1–3 minutes before it answers PINGs. The generous `start_period`
plus the `clamav-db` volume (so subsequent starts are fast) are both required. Do not gate app
startup on `clamav` being healthy at a tight interval.

### 2b. Env for `worker-app` (NOT storage-app or graphql-api-app)

```yaml
      CLAMAV_HOST: "clamav"
      CLAMAV_PORT: "3310"
```
`storage-app` and `graphql-api-app` get **no** ClamAV env and **no** dependency on the `clamav`
service — scanning happens only in worker-app.

### 2c. `depends_on` wiring

`worker-app.depends_on` (on top of the standard pnpm-install/db-migrate/packages-watch triad):
```yaml
      minio-init:
        condition: service_completed_successfully
      clamav:
        condition: service_started     # SOFT gate — do NOT wait for healthy
```
`storage-app.depends_on` adds only `minio-init` (completed) — the bucket must exist before it
serves uploads; it has no clamav gate at all anymore.
- **ClamAV is gated softly on purpose**: uploads don't scan inline, and the scan pipeline owns
  retry (in-handler backoff + reaper — `asset-scan-workflow.data.md`), so clamd's slow first boot
  (1–3 min) just delays verdicts — it must not block the worker from starting.

### 2d. clamscan client (`apps/worker-app/server/lib/clam.ts`)

```ts
import NodeClam from 'clamscan'
let clam: Awaited<ReturnType<InstanceType<typeof NodeClam>['init']>> | null = null
export async function getClam() {
  if (clam) return clam
  clam = await new NodeClam().init({
    clamdscan: {
      host: process.env.CLAMAV_HOST,
      port: Number(process.env.CLAMAV_PORT ?? 3310),
      timeout: 60_000,
      localFallback: false,     // no local binary in the app container — TCP only
    },
    preference: 'clamdscan',
  })
  return clam
}
```

Scan a buffer via a stream:
```ts
import { Readable } from 'node:stream'
const clamav = await getClam()
const { isInfected, viruses } = await clamav.scanStream(Readable.from(objectBuffer))
// isInfected → verdict 'infected' with viruses[0] as scan_signature (resolve-asset purges + soft-deletes)
```

If `clamd` is unreachable (still warming up / down), `init` or `scanStream` throws → the
**`scan-asset` handler** retries in-handler with backoff, and the **reaper** owns the long horizon
(fresh workflows up to a cap — see `asset-scan-workflow.data.md`); the asset stays `pending` in
`quarantine/` — never served — until a verdict lands. (The upload endpoint never talks to clamd.)

---

## 3. `storage-app` + `storage-layer` + `worker-app`

- **`packages/storage-layer`** — Nuxt layer, `extends: ['@function-bucket/fnb-tenant-layer']`
  (inherits the claims middleware). Owns: `server/api/upload.post.ts`, `server/lib/s3.ts` +
  `asset-validation.ts`, `app/components/`, `app/composables/`, `app/pages/assets/index.vue`.
  (The worker plugin, task handlers, and `clam.ts` moved to worker-app — Plan D.)
- **`apps/storage-app`** — thin app (msg-app precedent: ~3 files), `extends:
  ['@function-bucket/fnb-storage-layer']`. Scaffold with the **`fnb-create-app`** skill (app slug
  `storage`, path prefix `/storage`, no WebSocket) — note the skill assumes no `server/` dir, which
  is fine: all server code lives in the layer.
- **`apps/worker-app`** — **headless** Nuxt app, no layers, no pages beyond a placeholder
  `app.vue`, no nginx location, not in the `nginx`/`pinger` depends_on lists. Owns the stack's
  single graphile-worker plugin (`server/plugins/graphile-worker.ts`) and the consolidated
  `server/lib/worker-task-handlers/` (wf generic + wf-exerciser + asset-scan), plus its own
  `server/lib/s3.ts` + `clam.ts`.
- **nginx** (`docker/nginx.conf`): `location /storage { proxy_pass http://storage-app:3000; }`
  **before** the catch-all `location /`. No entry for worker-app.

- **Compose services**: `storage-app` copies the `msg-app` block — same Dockerfile
  (`apps/auth-app/Dockerfile`), `NUXT_APP_BASE_URL: "/storage"`, standard depends_on triad
  (pnpm-install / db-migrate / packages-watch) **plus** `minio-init` (completed), S3 env from 1d,
  a top-level `node_modules_storage_app:` volume + mount, an entry in `pnpm-install`'s volume
  list, and membership in the `nginx` depends_on. `worker-app` is the same shape minus
  `NUXT_APP_BASE_URL`/nginx, **plus** `clamav` (started — soft, see 2c), the `CLAMAV_*` env and
  the `ASSET_SCAN_*` tunables, with its own `node_modules_worker_app:` volume — **(v2 draft)**
  and its own Dockerfile with ffmpeg (§3a) instead of the shared `apps/auth-app/Dockerfile`.

### 3a. (v2 draft) worker-app Dockerfile — ffmpeg

worker-app leaves the shared `apps/auth-app/Dockerfile` for its own **`apps/worker-app/Dockerfile`**
— only the worker image carries ffmpeg (~80 MB); the routed apps keep the slim shared image:

```dockerfile
FROM node:22-alpine
RUN apk add --no-cache ffmpeg
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate
WORKDIR /app
EXPOSE 3000
```

`docker-compose.yml`: `worker-app.build.dockerfile: apps/worker-app/Dockerfile` (context stays
`.`). **No npm dependency** — ffmpeg is a system binary invoked via `spawn` from
`apps/worker-app/server/lib/ffmpeg.ts` (`asset-scan-workflow.data.md` → Image tooling). Rationale
(locked 2026-07-06): sharp/libvips would avoid the binary but only covers stills; video assets
(poster frames, transcodes) are anticipated, so ffmpeg comes in now. Image change ⇒ user-run
rebuild (`docker compose down && docker compose up --build` — ask the user; wipes/reseeds the DB,
which conveniently re-seeds the 4-uow wf template). Verify: `docker compose exec worker-app
ffmpeg -version`.

## 4. npm dependencies

- `packages/storage-layer` / `apps/storage-app` (upload endpoint + UI):
  - `dependencies`: `@aws-sdk/client-s3`, `file-type` (magic-byte sniffing — see
    `endpoint.data.md`), `pg`
- `apps/worker-app` (scan pipeline + wf engine handlers):
  - `dependencies`: `@aws-sdk/client-s3`, `clamscan`, `graphile-worker`, `camelcase-keys`,
    `@function-bucket/fnb-auth-server`, `pg`
  - `devDependencies`: `@types/clamscan`
- `apps/graphql-api-app` (presign + lazy job producer — see `graphql.data.md`):
  - `dependencies`: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `graphile-worker`

Because Docker uses **named `node_modules` volumes**, a local `pnpm install` does not reach the
container. After editing `package.json`:
```bash
docker compose up pnpm-install --force-recreate
docker compose restart storage-app worker-app graphql-api-app
```

No `packages-watch` entry needed for `storage-layer`: Nuxt layers are consumed **from source**
(verified — `msg-layer`'s package `main` is `./nuxt.config.ts`, no build step). Only compiled
packages (e.g. `graphql-client-api`, `fnb-types`) go through packages-watch.

---

## 5. Startup order (updated)

```
db → db-migrate (fnb-wf BEFORE fnb-storage — new sqitch dep) ┐
pnpm-install ────────────────────────────────────────────────┤→ packages-watch → apps
minio → minio-init (bucket + public/ policy) ────────────────┤
clamav (slow first boot; soft-gated) ────────────────────────┘
                                             storage-app depends_on:
                                               pnpm-install (completed)
                                               db-migrate (completed)
                                               packages-watch (healthy)
                                               minio-init (completed)
                                             worker-app depends_on (the ONLY graphile-worker migrator):
                                               pnpm-install (completed)
                                               db-migrate (completed)
                                               packages-watch (healthy)
                                               minio-init (completed)
                                               clamav (started — soft)
                                             graphql-api-app: UNCHANGED (no minio/clamav deps; no worker runner)
```

**`DEPLOY_PACKAGES` ordering:** `fnb-storage` now depends on `fnb-wf:00000000010520_wf_fn`
(`_shared.data.md`), so the deploy list must include `fnb-wf` (and whatever it depends on) **before**
`fnb-storage`. Resolved 2026-07-06: the compose default IS the source of truth and carries the full
seven-package ordered list (`fnb-auth fnb-app fnb-msg fnb-todo fnb-loc fnb-wf fnb-storage` —
`graphile.config.ts` exposes msg/todo/loc schemas, so all seven must deploy or PostGraphile fails at
boot). `.env.example` mirrors the key as an override-only comment; `.env` does not set it.

## 6. Infrastructure checklist

- [x] `minio-data`, `clamav-db`, `node_modules_storage_app`, `node_modules_worker_app` in top-level `volumes:`
- [x] `minio`, `minio-init`, `clamav`, `storage-app`, `worker-app` services added; `storage-app` in nginx `depends_on` (worker-app deliberately not)
- [x] nginx `location /storage` block (before catch-all); no nginx entry for worker-app
- [x] `DEPLOY_PACKAGES` includes `fnb-wf` before `fnb-storage`
- [x] Env: `S3_*` → storage-app (PutObject); `S3_*` + `CLAMAV_*` + `ASSET_SCAN_*` → worker-app; `S3_*` → graphql-api-app (presign); keys mirrored to `.env.example`
- [x] `worker-app.depends_on`: `minio-init` completed, `clamav` started (soft); `storage-app.depends_on`: `minio-init` completed
- [x] npm deps added per §4
- [x] `docker compose up pnpm-install --force-recreate && docker compose restart storage-app worker-app graphql-api-app`

## Ops defaults (implementer applies; not user decisions)

- [x] Image tags pinned 2026-07-07 (`minio/minio:RELEASE.2025-09-07T16-13-09Z`,
  `minio/mc:RELEASE.2025-08-13T08-35-41Z`, `clamav/clamav:1.5.3` — the versions running/verified
  in Phase 11). Bump deliberately, never `:latest`.
- Host-expose `clamd` TCP (3310) and MinIO console (9001) in **dev only**; keep them closed in any
  shared environment.
- Q2 resolved: dev credential defaults above; production secret sourcing deferred (no deploy target yet).
