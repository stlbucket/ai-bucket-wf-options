# Plan: Airports dataset — `fnb-airports` package, six-table CSV import, sync workflow, list/map/detail UI

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/tenant-app/datasets/airports/` (README +
> `_shared.data.md` + `sync-workflow.data.md` + `index.*` + `[id].*`) — this plan sequences it;
> it does not restate the spec (R21). Specialist skills: `new-db-package` (Phase 1),
> `sqitch-expert` (all DB phases), `fnb-db-designer` (RLS/grants), `postgraphile-5-expert`
> (Phase 4 verify), `graphile-worker-expert` (Phase 3), `airports-expert` (dataset facts —
> **no API exists**; six bulk CSVs). Never run `git` in a sqitch session; never rebuild/restart
> the env yourself — ask the user (memory `rebuild-ask-user`), then verify read-only.

**Severity: MED** (feature work) · Workstream: datasets · Planned: 2026-07-09 · Spec status:
Draft, no `[FILL IN]`s; both Open Questions deferred-by-design (map payload / GraphiQL names).

## Context

Second Datasets tool, produced by `/fnb-acquire-dataset`: ~85,700 world airports + runways,
frequencies, navaids, countries, regions from OurAirports (public-domain nightly CSVs on GitHub
Pages — no auth/key/rate limits; ETag conditional GET). New sqitch package **`db/fnb-airports`**
(`airports` schema trio, range **10800+**), public `loc.location` rows for every airport
(existing `is_public` mechanism — **no new `fnb-loc` changes**), a single-task `sync-airports`
wf workflow in worker-app, and a tenant-app list/map/detail UI under the existing `datasets`
module. All decisions locked in the spec README (#1–14).

## Carried-over resolutions (verified during breweries — reuse verbatim)

- **`in_progress` predicate** (breweries OQ1): root `type='wf'` uow status in
  (`incomplete`,`paused`,`waiting`,`trigger_set`) for `identifier = 'sync-airports'`,
  `is_template = false` — SQL shape in the breweries plan/`location_datasets_fn`.
- **`wf_api.queue_workflow` has no API-level gate** (breweries OQ2, user-accepted): sync
  trigger ships UI-gated only; deferred to issue `0030__wf________wf-rls-missing…`.
- **Template seed mechanism**: inline `wf_fn.upsert_wf` block in `db/seed.sql` (the
  `sync-breweries` block at `db/seed.sql:269+` is the copy template; task uow gets the distinct
  identifier `sync-airports-task`).
- **`db/db-config.ts` does not exist** — `DEPLOY_PACKAGES` lives in `.env:17` +
  `.env.example:42` only.
- **PostGraphile inflection surprises** (`…OptionInput` singularized, `_options` arg,
  `PagingOptionInput` fields) — re-verify in GraphiQL at the rebuild gate before writing
  `.graphql` docs.
- **Mapbox rejects `oklch(...)`** — probe-element `rgb()` resolution (UC6 pattern; copy from
  `BreweryMapView.vue`).

## Verified anchors (2026-07-09)

- `apps/graphql-api-app/server/graphile.config.ts:29` — `schemas` array (add `airports`,
  `airports_api`; base + `_api`, never `_fn`).
- `apps/worker-app/server/lib/worker-task-handlers/index.ts:17,40` — handler import +
  taskList registration pattern (`'sync-breweries'`).
- `pnpm-workspace.yaml` catalog has **no `csv-parse`** — single-consumer dep: declare a pinned
  version directly in `apps/worker-app/package.json` (R24: catalog is for shared packages).
- Live dataset facts + row counts + gotchas: `.claude/skills/airports-expert/SKILL.md` (recon
  2026-07-09; counts drift nightly — verify sync against the downloaded files' own counts).

## Implementation phases

Follows the spec README task list. **`pnpm build` is the gate** (repo lint is broken).
One new npm dependency total: `csv-parse` in worker-app.

### Phase 1 — new package `db/fnb-airports`
- Scaffold via `/new-db-package`; append `fnb-airports` after `fnb-location-datasets` in
  `DEPLOY_PACKAGES` (`.env:17`, `.env.example:42`).
- Changes per `_shared.data.md` §DB: `00000000010800_airports` (schemas + 5 enums + 7 tables
  incl. `sync_source`), `00000000010810_airports_fn` (composite types + six `upsert_*` +
  `record_sync_source` + `airport_sync_status` with the carried-over `in_progress` predicate),
  `00000000010815_airports_api` (3 fns, `jwt.enforce_any_permission(array['p:app-user',
  'p:app-admin'])`), `00000000010820_airports_policies` (grants + RLS `view_all using (true)`
  on all 7 tables; **no write policies**). Cross-project deps:
  `fnb-loc:00000000010340_loc_public_locations`, `fnb-app:00000000010250_app_policies`.
  Paging reuses `app_fn.paging_options`.
- Enum coercion armor in every upsert: raw value checked against `pg_enum`, unrecognized/empty
  → `'unknown'` + `upstream <col>: <raw>` appended to `notes` (recon already proved drift:
  docs say `closed_airport`, data says `closed`). `surface`/frequency `type` are **text**.

### Phase 2 — seed + nav + exposure (SQL that must precede the rebuild gate)
- `db/seed.sql`: inline `sync-airports` template block next to the `sync-breweries` block
  (`db/seed.sql:269+` as the copy source; root uow `sync-airports`, task uow
  `sync-airports-task`, `workflow_handler_key 'sync-airports'`, `useWorker true`, no
  input_definitions).
- Nav (R14): `tenant-datasets-airports` tool row (label "Airports", icon `i-lucide-plane`,
  route `/tenant/datasets/airports`, `p:app-user` + `p:app-admin`) added to the **existing**
  `datasets` module block in `db/fnb-app/deploy/00000000010240_app_fn.sql` — mirror the
  breweries tool row.
- `apps/graphql-api-app/server/graphile.config.ts:29`: add `airports`, `airports_api`.

### Phase 3 — worker handler
- `apps/worker-app/package.json`: add pinned `csv-parse` (direct dep — memory
  `pnpm-no-hoist-app-deps`; install lands with the rebuild).
- Handler `apps/worker-app/server/lib/worker-task-handlers/airports/sync-airports.ts` wrapped
  in `_workflowHandler` (same contract as sync-breweries: return `{ status: 'complete',
  stepData, workflowData }` / `{ status: 'error', errorInfo }`); register `'sync-airports'` in
  the taskList (`index.ts:40` pattern).
- Per `sync-workflow.data.md`: six files in dependency order (countries → regions → airports →
  runways → frequencies → navaids) from `https://davidmegginson.github.io/ourairports-data/`;
  per file read stored ETag from `airports.sync_source` → conditional GET (304 → skip) →
  stream-parse (`csv-parse`, RFC-4180, UTF-8) → 1,000-row jsonb chunks →
  `select airports_fn.upsert_<table>($1::jsonb)` → `record_sync_source`. Edge coercions in the
  handler: empty→null, numerics parsed (NaN→null), `'yes'/'no'`+`'1'/'0'`→boolean, lat/lon stay
  strings, `usageType` camelCase header mapped to `usage_type`. DB via `useFnbPgClient()`.

### ⏸ USER REBUILD GATE
Everything above lands only on rebuild (new sqitch package + seed + worker dep; memory
`rebuild-wipes-db`). **Ask the user to run it.** Then verify read-only:
- sqitch: `fnb-airports` deployed; schemas/tables/policies present; template seeded; nav row
  visible.
- GraphiQL (spec OQ2): `airport(id)`, `searchAirportsList`, `airportMapPointsList`,
  `airportSyncStatus`; child relation field names (`runwaysByAirportId`,
  `airportFrequenciesByAirportId`, `navaidsByAssociatedAirportId` — record actual inflections);
  input type names (`SearchAirportsOptionInput`?, `_options` arg); enum spellings
  (`AirportType` UPPERCASE, `NDB_DME`); **no** insert/update/delete mutations on any airports
  table.

### Phase 4 — fnb-types + graphql-client-api
- `packages/fnb-types`: `AirportType`/`Continent`/`NavaidType`/`NavaidUsageType`/`NavaidPower`
  enums (GraphQL values verbatim as recorded at the gate) + `Airport`/`Runway`/
  `AirportFrequency`/`Navaid`/`AirportMapPoint`/`AirportSyncStatus` per `_shared.data.md`
  §fnb-types (`location: Location` reuses the loc type) + barrel lines.
- Fragments/queries under `src/graphql/airports/` (full field expansion — memory
  `fragments-all-fields`); codegen; mappers `src/mappers/airport.ts` (`toAirport`, `toRunway`,
  `toAirportFrequency`, `toNavaid`, `toAirportMapPoint` — lat/lon `parseFloat`,
  `toAirportSyncStatus`).
- Composables `useAirports` (options ref + syncStatus + `queueSync` wrapping the existing
  `useQueueWorkflow`/`queueWorkflow` + ~10s polling while `inProgress`), `useAirport` (detail +
  child computeds), `useAirportMapPoints` (paused until `activate()`; `includeClosed` ref,
  default false).
- **Barrel** `src/index.ts` (the #1 miss) + tenant-app thin re-exports. `pnpm build` green.

### Phase 5 — pages + components
- `apps/tenant-app/app/pages/datasets/airports/index.vue` + `[id].vue`,
  `app/components/datasets/AirportListView.vue` / `AirportMapView.vue` — per `index.ui.md` /
  `[id].ui.md` (Nuxt UI **v4** only, UC13 `TableColumn`/`row.original`; UC4/5/6/7/12;
  type-badge map from `index.ui.md`; map center `[-98.5795, 39.8283]` zoom 3.5, clustered;
  oklch→rgb probe from `BreweryMapView.vue`; detail child tables runways/frequencies/navaids;
  mini map unconditional — 100% geocoded).
- Icons (UC11): verify `i-lucide-plane`; rest are breweries-verified.
- `'/datasets/**': { ssr: false }` already covers these routes — confirm, don't duplicate.

### Phase 6 — end-to-end verification (read-only; user runs any rebuild/restart)
Per spec README Phase 7: as `bucket@` (super-admin) — empty state → sync queues → instance in
Workflow Dashboard → completes; counts match the downloaded files' own row counts (~85.7k
airports / 48.1k runways / 30.3k frequencies / 11k navaids / 249 countries / 4k regions);
re-invoke → ETag 304 skips, counts stable, no dupes. As plain `p:app-user` — list/filters/
pagination, map clusters/popup/US default/closed-excluded default + include-closed switch,
detail with children (e.g. EGLL), **no sync button**. RLS spot-checks per spec (public
locations readable cross-tenant; tenant locations still invisible; no write path).

### Phase 7 — spec reconcile
Fold corrections back into the spec files (esp. actual inflected names + any recon drift into
`airports-expert`); flip Status lines to `Implemented — GraphQL`; check off README task list.
Ask the user before moving this plan to `addressed/` (memory `ask-before-moving-addressed`).

## Sequencing summary

1. Phases 1–3 (sqitch sessions — no `git`) → **user rebuild** → GraphiQL verify → Phase 4
   (codegen needs the live schema) → Phase 5 UI (hot-reloads; packages-watch rebuilds
   graphql-client-api/fnb-types) → Phase 6 → Phase 7.
2. Two user touchpoints: the rebuild, and sign-off at Phase 7.

## Post-implementation addendum (2026-07-10 — executed; spec is the source of truth)

Implemented 2026-07-09, first sync + UI verification 2026-07-10 (user-run, via the sync
button). Results: 85,716 airports / 48,096 runways / 30,312 frequencies / 11,009 navaids /
249 countries / 3,984 regions — every count matched the recon values exactly; 85,716 public
`loc.location` rows; one wf instance, `complete`; 0 skipped child rows; 0 `unknown` airport
types (live-probed enum vocab was complete); 31 navaid coercions (empty `usageType`/`power`).
**Every GraphiQL-verified inflection matched the spec's predictions** — no `.graphql` rework
(contrast breweries). Implementation deltas folded into the spec: reusable
`airports_fn.coerce_enum_label` helper (five enums vs breweries' one); complete
`Runway`/`Navaid` fnb-types (fragments-all-fields); `csv-parse` **sync** API (files ≤13 MB);
upstream ETags are weak (`W/"…"`), stored verbatim. The ETag-304 re-sync path is armed but not
yet exercised (single instance so far) — the next sync proves it; upserts are idempotent
regardless. R21 propagation done: CLAUDE.md, monorepo-bootstrap-pattern, graphql-api-pattern,
and the fnb-db-designer / sqitch-expert / new-db-package / fnb-stack-implementor /
legacy-ui-converter skills now list the ninth package + exposed schemas (new-db-package's next
free range is now `00000000011000`). Effort walkthrough for colleagues:
`.claude/specs/airports-summary.md`.

## Out of scope / linked

- API-level gating of `queueWorkflow('sync-airports')` — deferred to
  `0030__wf________wf-rls-missing__________________CRT__.plan.md` (same posture as breweries).
- Map payload optimization beyond the closed-by-default filter — spec Open Question 1, decide
  on live evidence only.
- `airport-comments.csv`, delete/tombstone pass, fan-out workflow, navaid/runway map layers,
  country/region pages — explicitly rejected in the spec.
