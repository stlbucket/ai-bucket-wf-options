# Asset Storage — Final Evaluation

**Date:** 2026-07-06
**Scope:** Full review of the `.claude/specs/asset-storage` implementation (Phases 1–10), spec-vs-code
conformance, live-system verification, and the worker-architecture question.
**Method:** Read every implementation file across all layers (DB sqitch package, docker-compose/nginx,
storage-layer server + UI, graphql-api-app presign/worker, graphql-client-api, fnb-types), diffed
against all 8 spec files, and ran read-only checks against the running system (GraphQL introspection,
psql over the sqitch registry / `wf.*` / `storage.asset` / `graphile_worker.jobs`).

---

## 1. Verdict

The implementation is **faithful to the spec and works end-to-end for the happy paths** — verified
live: private and public uploads → 202 PENDING → quarantine → ClamAV scan → promote → clean →
downloadable (presigned 15-min with filename restoration; public direct unsigned; anon fetch of
public objects works; anon cannot enumerate). All 8 sqitch changes have deploy/revert/verify and are
registered. The security posture decisions (no `storage_api` exposure, hidden `storage_key`/`bucket`,
fetch-by-reference public reads, `clean`-gated `downloadUrl`) are all correctly implemented.

**But there is one significant design defect (W1)**: the `scan_status='error'` terminal state is
**unreachable**, and the reaper cannot rescue a scan that exhausted its retries — such an asset is
stuck `PENDING` forever. This interacts badly with ClamAV's 1–3 minute first boot on a fresh
environment. Everything else is minor-to-moderate.

Live evidence at review time: 4 assets, all `clean|active` (3 private, 1 public); 4 completed
`asset-scan` workflows + 1 template in `wf.wf` (→ they will appear in the Workflow Dashboard);
0 stuck jobs in `graphile_worker.jobs`.

---

## 2. What's WRONG (ranked)

### W1 — HIGH: `scan_status='error'` is unreachable; errored scans strand assets in `PENDING` forever

The contract (asset-scan-workflow.data.md §Responsibilities #3, #5, #8) requires a terminal `error`
verdict and "no stranded assets." The implementation violates both, in combination:

- `scan-asset.ts` **throws** after its in-handler retries (4 attempts, ~20–30 s total). The
  `_workflow-handler.ts` factory **catches** the throw and calls `wf_fn.error_uow` → uow status
  becomes `'error'` (confirmed from the live `error_uow` definition) → the workflow errors →
  **`resolve-asset` never runs** → `resolve_asset_scan(_, 'error', …)` is never called.
  The `verdict === 'error'` branch in `resolve-asset.ts:55-60` is **dead code**.
- The reaper (`asset-scan-reaper.ts:19`) filters `u.status = 'incomplete'` — an errored uow is
  `'error'`, so the reaper **never re-queues it**. The asset stays `pending`; the UI shows
  "Scanning…" indefinitely; `downloadUrl` stays null; no operator signal (the "Scan error" badge
  specced in `_shared.data.md` can never appear).
- **Likely trigger:** upload during clamd's first boot. `storage-app` is (correctly) soft-gated on
  `clamav` `service_started`, but signature load takes 1–3 min while the scan retry budget is
  ~30 s. Also note the graphile-worker level never retries: `wf_fn.queue_workflow` enqueues with
  `max_attempts := 1` (00000000010520_wf_fn.sql:74) **and** the factory swallows throws, so the
  spec's "retries/backoff come free from graphile-worker" claim is inaccurate — all retry
  semantics are in-handler.

**Fix plan** (small, contained — see §5 Plan A): have `scan-asset` **return** a `'error'` verdict
after exhausting retries instead of throwing (making `resolve-asset`'s error branch live and the
workflow complete cleanly with a terminal `error` row), extend the reaper to also catch
errored-workflow/pending-asset pairs with a re-run cap, and raise the in-handler retry budget past
the clamd cold-boot window.

### W2 — MEDIUM: the worker migrate-race fix is one-sided, and `_workflow-handler` re-runs migrate per job

- The fresh-DB `graphile_worker` schema-install race was hot-fixed (2026-07-06) with a retry wrapper
  in **storage-layer's** plugin only. `apps/graphql-api-app/server/plugins/graphile-worker.ts:8-9`
  still has the unguarded `makeWorkerUtils` + `migrate()` — on the next fresh rebuild, the *other*
  side can lose the race and crash graphql-api-app's worker (killing wf-exerciser and any wf
  follow-on scheduling done there).
- `_workflow-handler.ts:16` (both copies) calls `makeWorkerUtils({connectionString})` **per job
  execution** — that opens a new pg pool *and internally runs the migrate check* on every job, then
  releases it in `finally`. Wasteful and a second (post-install, mostly-benign) race surface. It
  should be a module-level singleton — or better, follow-on jobs can be enqueued in SQL
  (`graphile_worker.add_job`) on the pg client the factory already holds.

The **structural** fix for the race is the architecture change in §4 (single worker). If two workers
are kept, mirror the retry wrapper into graphql-api-app's plugin.

### W3 — MEDIUM (spec conformance): soft-deleted (infected) assets do not drop out of the lists

`_shared.data.md` (badge section): "INFECTED rows are soft-deleted by the workflow (**so they drop
out of default active lists**)". But neither `AllAssets` nor `AssetsByOwningEntity` filters
`assetStatus`, and neither `useSiteAssets` nor `AssetList` filters client-side. An infected upload
will remain in `/storage/assets` forever as an `Infected` + `Deleted`-status row (with no download
button, correctly). For the *admin* page that may even be desirable (operators should see infected
attempts) — but it contradicts the spec, and the future todo/ticket embedding (`AssetsByOwningEntity`)
definitely shouldn't show a user their soft-deleted rows.

**Decide one:** (a) add `condition: { assetStatus: ACTIVE }` to `AssetsByOwningEntity` (entity pages)
while the site-admin `AllAssets` deliberately shows everything, updating the spec wording; or
(b) filter both. Recommend (a) — admin visibility of infected attempts is a feature. Either way,
codify it; today's behavior is accidental.

### W4 — MEDIUM (latent infra): `DEPLOY_PACKAGES` compose default is inconsistent with the exposed schemas

`docker-compose.yml:57` defaults to `fnb-auth fnb-app fnb-wf fnb-storage`, but the live DB has all
**seven** projects deployed (`fnb-msg`, `fnb-todo`, `fnb-loc` included — verified via the sqitch
registry) and `graphile.config.ts` exposes `msg/msg_api/loc/loc_api/todo/todo_api`. `.env` does
**not** set `DEPLOY_PACKAGES`, so the full list must be coming from the invoking shell. Anyone (or
CI) bringing this stack up without that shell state gets a DB missing four schemas and a PostGraphile
boot failure. This is exactly the `infrastructure.md:306` `[FILL IN]` that was never resolved.
**Fix:** make the compose default the full ordered list (`fnb-auth fnb-app fnb-msg fnb-todo fnb-loc
fnb-wf fnb-storage`) and mirror the key into `.env.example`.

### W5 — LOW/MEDIUM (hardening): chunked uploads bypass the pre-buffer size check

`upload.post.ts:52-54` rejects on the `content-length` header before `readMultipartFormData` buffers
the body — good — but a **chunked** request has no content-length (`Number(undefined ?? 0)` → 0 →
passes) and gets fully buffered before the per-file 10 MB check. Nitro/h3 sets no default body cap
here. Bounded DoS (memory) surface; also the still-open `endpoint.data.md:171` `[FILL IN]` ("Nitro
max body size confirmation"). Fix options in §5 Plan C.

### W6 — LOW: `NO_CONTEXT` + non-UUID `owningEntityId` → 500 instead of 400

`upload.post.ts:67` only UUID-validates `owningEntityId` when `context !== 'NO_CONTEXT'`. A
`NO_CONTEXT` upload with a junk `owningEntityId` string reaches the `$3::uuid` cast and fails as a
500 (and note `entitySeg` would embed the raw string in the storage key before the insert fails —
the object is orphaned with an unvalidated path segment). One-line fix: validate whenever present.

### W7 — LOW (spec drift, deliberate?): the insert gate is `enforce_any_permission(['p:app-admin','p:app-user'])`

Spec (`_shared.data.md`, README) locks upload permission to `p:app-user`. The deployed gate
(00000000010615_storage_api.sql:5) accepts `p:app-admin` **or** `p:app-user`, and the endpoint's
401/403 hint mirrors it (they are in sync with each other, per the code comment). Harmless if every
admin also holds `p:app-user`, but it's an undocumented widening — either revert to the spec or
record the decision in `_shared.data.md`.

### W8 — LOW here (pre-existing, stack-wide): everything connects as the `postgres` superuser

Every app (including PostGraphile and both workers) gets
`DATABASE_URL: postgresql://postgres:1234@…` (compose), not the `authenticator` role the security
model documents (`graphile.config.ts`'s *fallback* is authenticator, but the env overrides it).
RLS still fires because PostGraphile/`withClaims` `SET LOCAL ROLE` per operation, and it's what made
`resolve_asset_scan`'s `service_role`-only grant moot in practice (superuser bypasses it). Dev-only
posture and **not introduced by this feature**, but the asset feature's defense-in-depth analysis
(grants, `service_role`) is only meaningful once the connection role is `authenticator`. Worth a
stack-level ticket, not an asset-storage change.

### W9 — LOW: first-ever concurrent uploads for a tenant can 500 on the template seed

`ensure_asset_scan_wf` SELECT-then-insert inside the upload txn; `wf.wf` has
`idx_unique_wf_template (tenant_id, identifier) WHERE is_template` (00000000010500_wf.sql:217). Two
first uploads racing → one hits unique_violation → that upload 500s (client retry succeeds).
Tiny window, once per tenant. Fix: catch `unique_violation` in the function and re-select.

### W10 — LOW: no `mc ilm` lifecycle rule for orphaned `quarantine/*` objects

If step 6 (record+queue) fails after the PutObject, the object is orphaned with no DB row — the
reaper can't see it (it starts from rows). `infrastructure.md:99` and the workflow spec both propose
an `mc ilm` expiry (~7 days) in `minio-init`; not implemented. Dev-scale non-issue; one line to add.

### W11 — INFO (accepted/nits)

- `text/csv`/`text/plain` skip the magic-byte sniff (no reliable magic bytes — documented). This is
  also what lets the EICAR test file in as `.txt`, which Phase 11 *relies on*.
- OOXML sniff accepts the generic `application/zip` alias — a renamed plain zip passes as docx/xlsx;
  ClamAV still scans it. Accepted.
- Public `downloadUrl` is `` `${PUBLIC_BASE}/${key}` `` with no guard for `S3_PUBLIC_BASE_URL` being
  unset (→ literal `undefined/...`). Env is always set in compose; nit.
- The GraphQL `queueWorkflow` mutation path double-enqueues initial uows (SQL `add_job` inside
  `wf_fn.queue_workflow` **and** the `_scheduleUows` mutation wrapper) — pre-existing wf-engine
  quirk, not asset-storage; benign for `asset-scan` (idempotency guards) but a super-admin queuing
  `asset-scan` from the dashboard would double-scan. The stale `_queueWorkflow.ts`
  (`prj_fn.do_queue_workflow`) flagged in the README is indeed dead — `mutation-hooks/index.ts` only
  wires `queue-workflow.ts`.
- The upload endpoint uses `withClaims` from db-access — architecturally *right* (it's exactly the
  authorized-server-work-outside-GraphQL carve-out), but `graphql-api-pattern.md` still describes
  `withClaims` as "currently the msg-layer WS read" only. Doc drift; add the upload endpoint as the
  second consumer.

---

## 3. What's MISSING

| # | Item | Status/Severity |
|---|------|----------|
| M1 | **Phase 11 negative-path verification**: EICAR (infected → purge + soft-delete + badge), oversize → 413, wrong type → 415, magic-byte mismatch → 415, Workflow Dashboard eyeball | The only unverified spec behavior. Runbook in §5 Plan B. **Do Plan A first** — an EICAR test today exercises W1's dead code path only for `infected` (which *is* reachable); the clamd-down `error` case will fail the test as designed. |
| M2 | `useEntityAssets(context, owningEntityId)` composable | Spec-marked "(future)" — intentionally absent. The GraphQL op + generated hook already exist. |
| M3 | pg-notify → socket badge push | Recorded v2 refinement; v1 refresh/poll is per spec. |
| M4 | `mc ilm` quarantine expiry | = W10. |
| M5 | **Tests: none.** `packages/storage-layer` has no `vitest.config.ts`/spec files; `asset-validation.ts` (pure functions: context mapping, `extForContentType`, magic-byte accept-set) and `mappers/asset.ts` are ideal cheap targets under the house `src/tests/*.spec.ts` convention. graphql-client-api gained `useSiteAssets`/`toAsset` with no spec either. | Worth 1–2 hours; catches the next refactor. |
| M6 | Tenant-level nav for non-admins (`p:app-user` tool) | Recorded deferral; page reachable by URL. |
| M7 | Nav tool live in DB | The `tenant-site-admin-asset-manager` row exists in `00000000010240_app_fn.sql:336` (verified well-formed, icon exists) but the live DB predates it — appears after the next reseed. Expected. |
| M8 | `DEPLOY_PACKAGES` not mirrored in `.env.example` | = W4. |

Also verified-as-fine (no action): sqitch package complete (8/8 deploy+revert+verify, correct
cross-project dep on `fnb-wf`), RLS/grants match the fetch-by-reference design (anon: schema usage
only, no table grants; the default-privileges grant on `storage_fn` is correctly clawed back for
`resolve_asset_scan` by explicit revoke), `upsert_wf` signature `[FILL IN]` is **resolved de facto**
(the seeded template cloned and completed 4 real workflows), quarantine key formula incl. the
`no_context` uuid fallback matches spec, `.env.example` carries all S3/CLAMAV keys, iconify
collections declared in storage-app, urql plugin correct, barrels complete (types/client), and the
fragment selects every exposed field (R3).

---

## 4. The worker-architecture question

> Could we remove the worker-race by not having the worker in graphql-api-app and only in
> storage-app? Should we just have a process that is ONLY the worker?

**Yes to the mechanics, and yes — a dedicated worker process is the right call.**

### Why the race exists and what actually removes it

The race is two processes concurrently running graphile-worker's schema install
(`makeWorkerUtils()`/`migrate()`) against a fresh DB at boot. Any topology with **exactly one
at-boot migrator** eliminates it:

- Producers don't need a runner. graphql-api-app's only *hard* worker need is enqueueing follow-on
  uows for the GraphQL `queueWorkflow` mutation (`_scheduleUows.ts`) — and that's a **lazy**
  `makeWorkerUtils` (first mutation, long after boot, schema already installed → its internal
  migrate is a no-op read). The upload path enqueues **in SQL** and needs no worker instance at all.
- But you can't just delete graphql-api-app's runner: its taskList (`wf-exerciser` tasks,
  `close-workflow-wf`, `wait`, `acknowledge-trigger`) services the wf engine and the Workflow
  Dashboard. Those handlers must run *somewhere*. Moving them into storage-app's worker "works" but
  inverts ownership (the storage app becomes the host of generic wf infrastructure) — smell.

### Recommendation: `apps/worker-app` — one process that is ONLY the worker

A headless Nitro app (no routes, no nginx entry) whose single plugin runs the one
`makeWorkerUtils → migrate → run({ taskList })` with the **union** task list:

```
apps/worker-app/
  server/plugins/graphile-worker.ts   ← the ONLY migrate + runner in the stack
  server/lib/worker-task-handlers/    ← consolidated: wf generic (close-workflow-wf, wait, …),
                                        wf-exerciser, scan-asset, resolve-asset,
                                        asset-scan-completed, asset-scan-reaper (crontab)
```

- **Compose:** new service; env = DATABASE_URL + full `S3_*` + `CLAMAV_*`; `depends_on` db-migrate
  (completed), minio-init (completed), clamav (started, soft). **graphql-api-app loses its runner
  plugin, its S3/CLAM… wait — it keeps `S3_*` for presigning only (unchanged); it loses nothing
  else.** storage-app keeps `S3_*` (PutObject at upload) but **drops `CLAMAV_*`** and its worker
  plugin. nginx untouched.
- **Handler code location:** the honest end-state is the extraction the spec already records as a
  follow-up — a compiled `packages/worker-tasks` (or keep the pragmatic step: `worker-app` owns
  `server/lib/worker-task-handlers/` and the two current copies are deleted; `_workflow-handler.ts`
  stops being duplicated, fixing that drift too — and hoist its per-job `makeWorkerUtils` to a
  module singleton while touching it, closing W2's second half).
- **What this buys beyond the race:** single consumer to reason about/scale; job throughput no
  longer competes with HTTP serving; `nuxt dev` HMR restarts of the web apps no longer bounce (or
  transiently duplicate) workers; ClamAV coupling leaves the upload-serving app entirely; one place
  for worker observability. The `graphile-worker-expert` guidance and graphile-worker's own docs
  both treat dedicated worker processes as the default production shape.
- **Costs:** one more container; the storage-layer "self-contained module" story weakens slightly
  (its handlers move out of the layer — acceptable given they were already factory-copied); the
  wf spec's "second worker coexists safely" note gets superseded (it was true, just no longer
  needed).
- **Keep the retry wrapper** in the (now single) plugin anyway — it's free insurance and also
  covers a future horizontally-scaled worker (2+ replicas of worker-app racing is the same race).

**Interim options** if you defer the new app: (a) mirror the retry wrapper into graphql-api-app's
plugin (5 minutes, closes W2's exposure), or (b) install the schema once in `db-migrate` — but the
sqitch image has no Node, so that means a one-shot node container; at that point you're one step
from just building worker-app.

Per-tenant template seeding (`ensure_asset_scan_wf`) is orthogonal to all of this and stays as-is.

---

## 5. Plans

### Plan A — Fix W1: reachable `error` verdict + reaper coverage (do this first)

1. **`scan-asset.ts`:** on exhausting retries, `return { status: complete, stepData: { verdict:
   'error', signature: null }, workflowData: { scanVerdict: 'error', scanSignature: null,
   scanError: String(lastErr) } }` instead of `throw`. The workflow then proceeds to
   `resolve-asset`, whose `'error'` branch (already written, currently dead) records the terminal
   state via `resolve_asset_scan(_, 'error', …)`; bytes stay in quarantine for operator review;
   the workflow **completes** (dashboard shows a completed run whose resolution is `error` —
   arguably better than an errored workflow; keep `throw` only for programmer errors like missing
   assetId, where an errored workflow is the right signal).
2. **Retry budget:** raise to cover clamd cold boot — e.g. `SCAN_RETRIES=8`, backoff `15s * attempt`
   (~9 min worst case; jobs are async so latency is fine). Alternatively (nicer): keep attempts
   short but let the **reaper** own long-horizon retry (next point).
3. **Reaper v2 (`asset-scan-reaper.ts`):** two queries instead of one —
   (a) current: `uow incomplete + asset pending + older than 15 min` → re-`addJob` (lost-job case);
   (b) new: `asset pending + older than 15 min + NO live asset-scan workflow` (workflow errored,
   or resolve died mid-flight) → cap check → either `wf_api.queue_workflow('asset-scan', …)` afresh
   (needs claims-less tenant context — call `wf_fn` path with the asset's tenant, or run
   `resolve_asset_scan(_, 'error', …)` directly once the cap (propose **3 workflow attempts**,
   tracked in a `data` counter or by counting `wf.wf` rows per assetId) is hit.
4. **Operator flow for `error` rows** (the recorded open question): v1 = they're visible as the
   `warning` "Scan error" badge on `/storage/assets`; recovery = re-upload. Document that; a
   "re-scan" admin action is a v2 item.
5. Update `asset-scan-workflow.data.md` (retract the "retries come free from graphile-worker"
   claim — `max_attempts := 1` + factory catch means all retries are in-handler/reaper) and close
   its two open `[FILL IN]`s (cadence 15 min / cap 3; upsert_wf signature verified de facto).
6. **Test:** stop the clamav container, upload, watch `pending → error` within the retry horizon +
   badge shows "Scan error"; restart clamav; verify re-upload scans clean.

### Plan B — Phase 11 verification runbook (after Plan A)

| Case | Do | Expect |
|---|---|---|
| EICAR | Upload `eicar.txt` (`text/plain`, the 68-byte string) | 202 PENDING → row flips `INFECTED`, `asset_status='deleted'`, `scan_signature` like `Eicar-Signature`; quarantine object **gone** (mc ls); no `downloadUrl`; (per W3 decision) row visible-or-hidden as decided |
| Oversize | 11 MB file, normal POST | **413** before buffering (content-length path) |
| Oversize-chunked | 11 MB via `curl -H 'Transfer-Encoding: chunked'` | Today: buffered then 413 (W5); after Plan C: rejected early |
| Wrong type | `.exe` / `application/zip` | **415** (whitelist) |
| Type forgery | HTML bytes named `x.png` with `type=image/png` | **415** (magic-byte sniff) |
| Anon posture | `publicAsset(_id:)` for a clean public asset / a private asset / a pending asset | row / empty / empty; `assetsList` as anon errors |
| Pending gate | Query immediately after upload | `downloadUrl: null`, badge "Scanning…" |
| Dashboard | `/graphql-api/workflow` as super-admin | asset-scan runs listed incl. the EICAR one |
| Error path | Plan A §6 | terminal `error`, badge "Scan error" |

### Plan C — the three leftover `[FILL IN]`s (+ W4)

1. **Pin images** (`infrastructure.md` ×2): `minio/minio:RELEASE.2024-xx…`, `minio/mc:RELEASE…`,
   `clamav/clamav:1.4` (pick current stable at execution time); one compose edit + spec note.
2. **Nitro body cap** (`endpoint.data.md`): keep the content-length pre-check, and close the chunked
   hole (W5) — simplest: reject `transfer-encoding: chunked` on this route (uploads from browsers
   always carry content-length for FormData), or read the stream with a manual 11 MB abort guard.
   Verify with the Plan B chunked case. Update the spec's hardening note.
3. **`DEPLOY_PACKAGES` source of truth** (`infrastructure.md:306`, = W4): compose default → full
   7-package ordered list; add the key (blank) to `.env.example`; note in
   `monorepo-bootstrap-pattern.md` if that's where compose env is documented.
4. (`upsert_wf` signature `[FILL IN]` — already resolved de facto; just tick it in the spec, part
   of Plan A §5.)

### Plan D — dedicated worker (§4) — suggested sequence

1. Scaffold `apps/worker-app` (headless: `fnb-create-app` then strip pages/nginx, or hand-roll ~4
   files); compose service with env/depends_on per §4.
2. Move both task-handler trees under it (union taskList + the reaper crontab); delete the two
   nitro worker plugins; keep ONE plugin with the retry wrapper; singleton-ize
   `_workflow-handler`'s workerUtils (or switch follow-ons to SQL `graphile_worker.add_job`).
3. graphql-api-app: keep `_scheduleUows` (lazy producer) and presign `s3.ts`; storage-layer: keep
   upload endpoint + S3; drop `CLAMAV_*` from storage-app env.
4. Rebuild; verify: fresh-DB boot with no unhandledRejection in any app; upload → scan completes;
   dashboard `queueWorkflow` (exerciser) still runs; reaper cron fires.
5. Update specs per R21: `asset-scan-workflow.data.md` (worker location), `infrastructure.md`
   (service table/startup order), `package-layers-pattern.md` + both skills if the layer inventory
   changes, README locked-decisions row.

**Suggested order: A → C(3/W4 quick) → B → D → C(1,2).** A unblocks honest Phase-11 results; W4 is a
two-line landmine; B certifies; D is the structural improvement; image pinning last (pure ops).

---

## 6. Question answers, condensed

- **Is anything missing?** No functional spec item is missing from Phases 1–10. The gaps are: Phase
  11 negative-path verification (M1), tests (M5), the quarantine lifecycle rule (W10/M4), and the
  deliberately-deferred items (entity composable, pg-notify push, tenant-level nav).
- **Is anything wrong?** One real defect (W1 — unreachable `error` state + reaper blind spot), one
  half-finished fix (W2 — race guard only on one of two workers, per-job workerUtils), one spec
  conformance drift (W3 — soft-deleted rows still listed), one latent infra landmine (W4 —
  `DEPLOY_PACKAGES` default), plus the small stuff (W5–W11). Nothing security-critical: the
  quarantine gating, anon posture, and presign gating all check out against the live system.
- **Remove the race by having only one worker?** Yes — one at-boot migrator ends the race, and the
  remaining lazy producers are safe. But graphql-api-app's taskList must be rehomed, so the clean
  form of "only one worker" is your instinct: **a dedicated worker-only process** (Plan D), which
  also fixes the copied-factory drift and takes ClamAV/job load out of the HTTP apps. Keep the
  migrate-retry as insurance for future multi-replica workers.
