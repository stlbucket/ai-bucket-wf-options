# Airports Dataset — Spec Index

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below, then
> executes it. (Implemented 2026-07-10 — this directive is the entry point for future
> extensions; the original run's plan is
> `0010__loc_______airports-dataset________________MED__.plan.md`.)

## Status
**Implemented — GraphQL (2026-07-10).** Specced via `/fnb-acquire-dataset` 2026-07-09, built the
same day, first sync run + UI-verified by the user 2026-07-10. Sync results matched recon
exactly: **85,716 airports / 48,096 runways / 30,312 frequencies / 11,009 navaids / 249
countries / 3,984 regions**, 85,716 public `loc.location` rows, one `sync-airports` instance,
status `complete`. **Zero** airports coerced to `unknown` (the live-probed enum vocabulary was
right); 31 navaid enum coercions (the ~27 empty `usageType`/`power` rows recon predicted).
7,374 navaids resolved to an airport by ident. Per-file ETags recorded in
`airports.sync_source` (upstream serves **weak** ETags, `W/"…"` — fine for `If-None-Match`).
Implementation notes: every GraphiQL-verified name matched this spec's expectations (a first —
breweries had surprises); the enum drift armor was factored into a reusable
`airports_fn.coerce_enum_label(regtype, text)` helper; `Runway`/`Navaid` fnb-types carry **all**
columns (fragments-select-all-fields rule), not the lean subset first drafted. Recon source of
truth: `.claude/skills/airports-expert/SKILL.md`.

## Purpose

The second tool in the **Datasets** module (pattern prototype: breweries —
`.claude/specs/tenant-app/datasets/breweries/`): a read-only, **public** dataset of ~85,700
world airports plus their runways, radio frequencies, navaids, and the country/region lookup
tables — from OurAirports (https://ourairports.com).

OurAirports has **no API**. The entire database is published nightly as seven public-domain
CSV files on GitHub Pages (`davidmegginson.github.io/ourairports-data/`); the sync downloads
six of them whole (skipping `airport-comments.csv`) and upserts locally. No auth, no key, no
rate limits; `ETag`/`Last-Modified` support makes re-sync conditional-GET cheap.

Six tables live in a dedicated **`airports`** schema (new sqitch package `db/fnb-airports`).
Each **airport** FKs to a public `loc.location` row (anchor tenant, `resident_id` null,
`is_public = true` — the mechanism breweries built; airports are 100% geocoded upstream).
A site-admin presses "Sync airports" → the **`sync-airports`** wf workflow's single worker
task downloads/parses/upserts all six files in dependency order. Re-invoking is the refresh
*and* retry story — updates in place, never deletes.

Every signed-in user (`p:app-user` or `p:app-admin`) browses three ways: a paginated,
filterable **list**, a clustered Mapbox **map** (US default viewport; `closed` airports
excluded by default), and a read-only **detail** page with runway/frequency/navaid child
tables. Nobody writes through the API.

## Locked decisions

Resolved with the user 2026-07-09 (via `/fnb-acquire-dataset` Phase 1); rows marked *(spec)*
are spec-level choices made within those user decisions.

| # | Area | Choice |
|---|------|--------|
| 1 | Schema/packaging | **Dedicated `airports` schema** (+ `_fn`/`_api` trio) in new sqitch package **`db/fnb-airports`**, range **10800+** (next free; 10900 is `fnb-auth`'s webhook) — user chose dedicated over `location_datasets` because recon found 6 tables (>3 threshold) |
| 2 | Import scope | **All six CSVs** — airports, runways, airport-frequencies, navaids, countries, regions (~180k rows, ~24 MB). `airport-comments.csv` skipped (user comments, malformed header, no modeling value) |
| 3 | Location rows | **Every airport** (all 85,716, incl. 13,331 `closed`) gets a public `loc.location` row — existing `is_public` mechanism (`fnb-loc:00000000010340`), **no new `fnb-loc` changes needed**. Only airports get the loc split; runway ends/navaids keep plain coordinate columns *(spec)* |
| 4 | Read access | Breweries default: `p:app-user` or `p:app-admin` (`jwt.enforce_any_permission`), `using (true)` SELECT policies, **no write path via API** |
| 5 | Sync trigger | Breweries default: `p:app-admin-super`, UI-gated button (API-level wf gate deferred to issue 0030) |
| 6 | Workflow shape | Breweries default: **single `sync-airports` task** (root uow `sync-airports`, task uow `sync-airports-task`), template seeded as an inline `wf_fn.upsert_wf` block in `db/seed.sql` |
| 7 | Refresh story | Upserts keyed on `external_id` (upstream persistent integer id); re-invocation = refresh + retry; **no delete pass**; per-file **ETag conditional GET** skips unchanged files (new `airports.sync_source` bookkeeping table) *(spec)* |
| 8 | Enum posture | Non-negotiable drift armor: `'unknown'` sentinel + `notes` on every enum column; upsert coerces via `pg_enum` and records the raw value. Recon already proved the need: docs say `closed_airport`, data says `closed` |
| 9 | NOT enums | `runway.surface` (664 distinct live values) and `airport_frequency.type` (549 distinct) are **free text** — recon-verified; do not model as enums *(spec)* |
| 10 | Views | List + detail + clustered map (breweries default). Map default viewport continental US; **map excludes `type='closed'` by default** with an "Include closed" switch — payload discipline for ~72k vs ~85k points *(spec)* |
| 11 | Detail page | Read-only card + child tables: runways, frequencies, associated navaids; mini map always renders (100% geocoded). Countries/regions get **no pages** — import-side lookups only *(spec)* |
| 12 | Nav | Existing `datasets` module; new tool `tenant-datasets-airports` / "Airports" / `i-lucide-plane` → `/tenant/datasets/airports`, `p:app-user` + `p:app-admin` (R14) |
| 13 | Env | **Nothing new** — no API key exists to configure; Mapbox token already flows to tenant-app. One new worker-app dep: `csv-parse` *(spec)* |
| 14 | Region/country display | `location.state`/`location.country` store the upstream ISO **codes**; region/country names live in the lookup tables for future display use *(spec)* |

## Files in this spec

| File | Covers |
|------|--------|
| `_shared.data.md` | Data model — `airports` trio, six tables + `sync_source`, enums + NOT-enums, CSV field mapping, `_fn`/`_api` functions, fnb-types, GraphQL client setup, nav, permissions |
| `sync-workflow.data.md` | The `sync-airports` wf workflow — template seed, queueing, worker task handler (six-file download/parse/upsert walk, ETag skips, error posture) |
| `index.ui.md` | Landing page — list/map toggle, filter row, sync control, `AirportListView` / `AirportMapView`, type badge colors |
| `index.data.md` | Landing page data — `SearchAirports` / `AirportMapPoints` / `AirportSyncStatus` queries, `useAirports` / `useAirportMapPoints` composables, polling, auth |
| `[id].ui.md` | Detail page — header/blocks layout, runway/frequency/navaid child tables, mini map, loading/not-found states |
| `[id].data.md` | Detail page data — `Airport` query by id incl. child relations, `useAirport` composable |

## Implementation Task List

Step-by-step build order; each phase independently verifiable. DB phases are sqitch sessions —
**no `git` during sqitch**; deploys land on the next rebuild (user-run — never rebuild
yourself; memory `rebuild-wipes-db`). Breweries plan
(`0010__loc_______breweries-dataset_______________MED__.plan.md`) is the sequencing template.

### Phase 1 — `fnb-airports` package (`_shared.data.md` §DB)
- [x] Scaffold via `/new-db-package`; changes `10800` (schemas + enums + seven tables),
      `10810` (`_fn` types + six upserts + `record_sync_source` + `airport_sync_status`),
      `10815` (`_api` fns), `10820` (grants + RLS). Cross-project deps on
      `fnb-loc:00000000010340` + `fnb-app:00000000010250`.
- [x] Append `fnb-airports` to `DEPLOY_PACKAGES` in `.env` + `.env.example` (after
      `fnb-location-datasets`).

### Phase 2 — Workflow seed + nav (SQL that must precede the rebuild gate)
- [x] `sync-airports` template as an inline `wf_fn.upsert_wf` block in `db/seed.sql` (next to
      the `sync-breweries` block; task uow identifier `sync-airports-task`).
- [x] `tenant-datasets-airports` tool row (existing `datasets` module) in
      `db/fnb-app/deploy/00000000010240_app_fn.sql` (R14).
- [x] Add `airports` + `airports_api` to `graphile.config.ts` `schemas`.

### Phase 3 — Worker handler (`sync-workflow.data.md`)
- [x] Add `csv-parse` to `apps/worker-app/package.json` (direct dep — memory
      `pnpm-no-hoist-app-deps`; install lands with the rebuild).
- [x] Handler `apps/worker-app/server/lib/worker-task-handlers/airports/sync-airports.ts`
      (`_workflowHandler`-wrapped; six files in dependency order; ETag conditional GET; 1,000-row
      chunks); register `'sync-airports'` in the taskList.

### Phase 4 — **User rebuild gate**
- [x] All sqitch/seed/nav SQL + worker dep above land here: **ask the user to rebuild** (memory
      `rebuild-ask-user`); verify read-only after (sqitch status, schemas present, template
      seeded, nav row visible).
- [x] Verify in GraphiQL (Open Question 2): `airport(id)`, `searchAirports`,
      `airportMapPoints`, `airportSyncStatus`, child relation field names
      (`runwaysByAirportId`, …), input type names (`SearchAirportsOptionInput`?, `_options`
      arg), enum spellings (`NDB_DME`) — **before** writing `.graphql` documents; no
      insert/update mutations present.

### Phase 5 — types + GraphQL client (`_shared.data.md` §fnb-types, §GraphQL Client Setup)
- [x] `Airport` / `AirportType` / `Continent` / `Runway` / `AirportFrequency` / `Navaid` (+
      enums) / `AirportMapPoint` / `AirportSyncStatus` in `fnb-types` (GraphQL enum values
      verbatim, UPPERCASE); barrel-export.
- [x] Fragments (full field expansion — memory `fragments-all-fields`) + queries under
      `src/graphql/airports/`; codegen; mapper `src/mappers/airport.ts`.
- [x] Composables `useAirports` / `useAirport` / `useAirportMapPoints` + package index exports
      + tenant-app re-exports. `pnpm build` green.

### Phase 6 — Pages + components (`index.*`, `[id].*`)
- [x] `pages/datasets/airports/index.vue` + `AirportListView.vue` / `AirportMapView.vue`
      (components dir `datasets/`); `pages/datasets/airports/[id].vue`.
- [x] Icon check (UC11): `i-lucide-plane` + the breweries-verified set.

### Phase 7 — End-to-end verification (breweries Phase 8 mirror)
- [x] As super-admin `bucket@`: empty state → sync queues → workflow visible in the Workflow
      Dashboard → status flips in-progress → completes; counts match the downloaded files' own
      row counts (~85.7k airports / ~48.1k runways / ~30.3k frequencies / ~11k navaids / 249
      countries / ~4k regions — drift nightly, verify against the sync's own totals).
- [ ] Re-invoke sync: ETag 304 skips (fast no-op), counts stable, no duplicates. **Not yet
      exercised** — only one instance has run; the ETags are stored, so the next sync (any day)
      proves this path. Upserts are idempotent by construction either way.
- [x] As a plain `p:app-user`: list/filters/pagination, map clusters + popup + US default +
      closed-excluded default, detail page (incl. an airport with runways/frequencies/navaids,
      e.g. EGLL), **no sync button**.
- [x] RLS spot-checks: airport rows + their public locations readable via `view_all` /
      `view_public` (user-verified through the UI as a signed-in user); **no write path via
      GraphQL** (introspection confirmed zero airport mutations).

### Phase 8 — Spec reconcile
- [x] Fold implementation corrections back into these files (esp. actual inflected names);
      flip Status lines to `Implemented — GraphQL`; update `airports-expert` if live data
      contradicted recon.

## Remaining Open Questions

**None — both resolved 2026-07-10** (details in `_shared.data.md` §Open Questions):

1. **Map payload scale** — shipped as specced: ~72k points, query paused until the map is
   first opened, `closed` excluded by default. UI-verified working; the server-side type-filter
   fallback stays recorded but there is no live evidence it's needed.
2. **Inflected GraphQL names** — verified in GraphiQL post-rebuild before writing the
   `.graphql` documents; **everything matched the spec's expectations**, including the child
   relation fields (`runwaysList` / `airportFrequenciesList` / `navaidsByAssociatedAirportIdList`
   — PgSimplifyInflection drops the `ByAirportId` suffix on the unambiguous FK relations),
   `SearchAirportsOptionInput` / `AirportMapPointOptionInput` with the `_options` arg,
   `PagingOptionInput { itemOffset, pageOffset, itemLimit }`, and enum spellings (`NDB_DME`).

## Considered & rejected

- **`location_datasets` placement** — offered as the breweries default; user chose the
  dedicated package after recon surfaced 6 tables (the `/fnb-acquire-dataset` >3-table rule).
- **Importing `airport-comments.csv`** — rejected: user-generated comment text, malformed
  header, no modeling value.
- **Enums for `runway.surface` / `airport_frequency.type`** — rejected: recon found 664/549
  distinct live values; the data dictionary's "allowed values" lists are fiction. Text columns.
- **Trusting the data dictionary's `closed_airport` type value** — the live value is `closed`
  (13,331 rows); recon wins, and the `'unknown'` armor catches any future flip.
- **loc rows / map pins for navaids and runway ends** — rejected: only airports are the
  map-facing entity; navaids/runway ends keep plain coordinate columns (extendable later).
- **Fan-out workflow (one UOW per file)** — rejected: six sequential downloads + upserts run in
  minutes; single task = single retry unit, and ETag skips make re-runs cheap (same reasoning
  as breweries, reinforced by conditional GET).
- **A delete/tombstone pass** — rejected: upstream marks closures via `type='closed'`; stale
  rows acceptable for a reference dataset.
- **Live per-request proxying of OurAirports** (no local tables) — rejected: there is no API
  to proxy; bulk CSV is the only access mode, and local tables are the point of the Datasets
  module.
