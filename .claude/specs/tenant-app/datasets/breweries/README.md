# Breweries Dataset — Spec Index

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below, then
> executes it. (Implemented 2026-07-09 — this directive is the entry point for future
> extensions; the original run's plan is in `addressed/`.)

## Status
**Implemented — GraphQL (2026-07-09).** Built and verified end-to-end the same day it was
specced: 11,745 breweries synced, no dupes, list/map/detail live in tenant-app. Implementation
plan: `.claude/issues/identified/0010__loc_______breweries-dataset_______________MED__.plan.md`.
Implementation corrections are folded into these files (see each file's Status line); the
notable ones: undocumented upstream `brewery_type` values (self-healing `unknown` coercion +
`notes`), the task uow identifier (`sync-breweries-task` — the root uow claims the wf
identifier), nav/read permissions widened to `p:app-user` **or** `p:app-admin`
(`jwt.enforce_any_permission`), tenant-app `routeRules` needing `'/datasets/**': { ssr: false }`,
and Mapbox rejecting `oklch(...)` theme colors (probe-element `rgb()` resolution — UC6).
Post-implementation addition (user request): `loc.location.is_geolocated` generated column
(`fnb-loc:00000000010350`) + a "Geocoded only" search toggle.

This is also the **prototype for a repeatable pattern**: when this stack ships, the exercise
culminates in a new `/fnb-acquire-dataset` skill — point it at an API doc and it reproduces this
shape (dataset schema + public `loc.location` rows + sync workflow + Datasets tool with
list/map/detail). Details to be worked out with the user at the end (memory
`acquire-dataset-skill`).

## Purpose

The first tool in a new **Datasets** module: a read-only, **public** dataset of ~11,700
breweries from Open Brewery DB (`https://api.openbrewerydb.org/v1` — free, no auth; see
`.claude/skills/breweries-expert/SKILL.md`).

The split mirrors the source data: API-specific fields (`name`, `brewery_type`, `phone`,
`website_url`, upstream UUID) live in a new **`location_datasets.brewery`** table; the
address/geo fields live in a **`loc.location`** row each brewery FKs to. Those location rows
introduce a new concept to `loc`: **public locations** — owned by the anchor tenant,
`resident_id` null, `is_public = true`, readable by every authenticated user via a new RLS arm.

A fresh system has **no data**. A site-admin presses "Sync breweries" on the list page, which
queues the **`sync-breweries` wf workflow**; a single worker task walks the API
(`meta.total / 200` pages, sequentially) and upserts everything keyed on the upstream UUID.
Re-invoking is the refresh story — updates in place, inserts new records, never deletes.

Every signed-in user (`p:app-user` or `p:app-admin`) can browse the data three ways: a paginated, filterable
**list**, a clustered Mapbox **map** defaulting to the continental US, and a read-only
**detail** page. Nobody can write through the API — no write policies, no write mutations;
writes happen only inside `location_datasets_fn` from the worker's root-of-trust client.

## Locked decisions

All resolved with the user 2026-07-09.

| # | Area | Choice |
|---|------|--------|
| 1 | Schema name | **`location_datasets`** (+ `_fn` / `_api` trio) — renamed from the initial `brews` idea; the module is a home for future datasets, not just breweries |
| 2 | Location rows | `loc.location` gains `is_public boolean not null default false`; public rows owned by the **anchor tenant** (`app.tenant.type = 'anchor'`); new `view_public` SELECT policy (`using (is_public = true)`); existing tenant policy untouched |
| 3 | `resident_id` | Made **nullable** on `loc.location` — public dataset rows have no owning resident; tenant flows keep requiring it at the `loc_fn`/`loc_api` layer |
| 4 | Read access | Everyone signed in (`p:app-user` or `p:app-admin` — `jwt.enforce_any_permission` in `_api`): `using (true)` SELECT policy on `brewery`, `view_public` on locations |
| 5 | Write access | **Nobody via API.** No write policies/mutations; `location_datasets_fn.upsert_breweries` is worker-only (no `_api` wrapper — same trust model as `wf_fn.complete_uow`) |
| 6 | Sync trigger | **Site-admin only** (`p:app-admin-super`) — button on the list page; volunteer-run upstream API, so not user-triggerable |
| 7 | Import scope | **Everything** (~11,700) including `planning`/`closed` types (and deprecated `large`/`bar` in the enum) — list view filters visually |
| 8 | Workflow shape | **Single sync task** (init → sync-breweries → close), not a per-page fan-out — one retry unit, ~59 sequential pages ≈ minutes; template seeded like `wf-exerciser` (planning correction: as an **inline `wf_fn.upsert_wf` block in `db/seed.sql`** — the next-to-handler SQL mechanism is stale) |
| 9 | Upsert semantics | Keyed on `brewery.external_id` (upstream UUID); re-invocation updates in place; **no delete pass** (upstream `closed` type covers the common case) |
| 10 | Sync UX | "Last synced \<time\> · N breweries" status line + button disabled/spinner while a sync instance is running (`brewery_sync_status()` api fn; composable polls ~10s while in progress) |
| 11 | Queue mechanism | Reuse the existing `wf_api.queue_workflow` / `useQueueWorkflow` machinery — no new mutation |
| 12 | Nav | New module `datasets` / "Datasets" / `i-lucide-database`, tool `tenant-datasets-breweries` / "Breweries" / `i-lucide-beer` → `/tenant/datasets/breweries`, `p:app-user` + `p:app-admin` on both module and tool rows (registered in `00000000010240_app_fn.sql`, R14) |
| 13 | Landing default | **List view** first; toggle to map. Filters (name ilike, type, state, country, geocoded-only switch) apply to the list only |
| 14 | Map | Existing `mapbox-gl` + `nuxt-mapbox` stack (`MAPBOX_ACCESS_TOKEN`, precedent `loc/[id].vue`); **clustered** GeoJSON source; default viewport continental US (center `[-98.5795, 39.8283]`, zoom 3.5); lightweight `brewery_map_points()` payload; "N without coordinates" footnote |
| 15 | Detail page | Read-only card: address/contact/meta blocks + single-marker mini map when geocoded; no edit/delete affordances |
| 16 | DB packaging | New sqitch package **`db/fnb-location-datasets`** (range 10700+), appended to `DEPLOY_PACKAGES` after `fnb-storage`; plus new `fnb-loc` change `00000000010340_loc_public_locations` |
| 17 | Env | **Nothing new** — Open Brewery DB needs no key; Mapbox token already flows to tenant-app |
| 18 | Geolocation flag | `loc.location.is_geolocated` **generated column** (`lat`/`lon` both present, `fnb-loc:00000000010350`) — flags rows needing geolocation across all loc flows; surfaced as a "Geocoded only" list filter (`search_breweries_options.is_geolocated`: null/all, true/geocoded, false/ungeocoded) |

## Files in this spec

| File | Covers |
|------|--------|
| `_shared.data.md` | Data model — `location_datasets` trio, `brewery` table + enum, `loc.location` changes, RLS, `_fn`/`_api` functions, API field mapping, fnb-types, GraphQL client setup, nav, permissions |
| `sync-workflow.data.md` | The `sync-breweries` wf workflow — template seed, queueing from the UI, worker task handler (pagination walk, error posture, politeness) |
| `index.ui.md` | Landing page — list/map toggle, filter row, sync control, `BreweryListView` / `BreweryMapView` components, type badge colors |
| `index.data.md` | Landing page data — `SearchBreweries` / `BreweryMapPoints` / `BrewerySyncStatus` queries, `useBreweries` / `useBreweryMapPoints` composables, polling, auth |
| `[id].ui.md` | Detail page — layout blocks, mini map, loading/not-found states |
| `[id].data.md` | Detail page data — `Brewery` query by id, `useBrewery` composable |

## Implementation Task List

Step-by-step build order; each phase independently verifiable. DB phases are sqitch sessions —
**no `git` during sqitch**; deploys land on the next rebuild (user-run — never rebuild yourself;
memory `rebuild-wipes-db`).

### Phase 1 — `fnb-loc`: public locations (`_shared.data.md` §DB 1)
- [x] New change `00000000010340_loc_public_locations` — `is_public` column, `resident_id` drop
      not null, `view_public` policy; matching `revert/` + `verify/`; plan entry.

### Phase 2 — `fnb-location-datasets` package (`_shared.data.md` §DB 2)
- [x] Scaffold via `/new-db-package`; changes `10700` (schemas + enum + table), `10710` (`_fn`
      types + `upsert_breweries` + `brewery_sync_status`), `10715` (`_api` fns), `10720`
      (grants + RLS). Cross-project deps on `fnb-loc:00000000010340` + `fnb-app:00000000010250`.
- [x] Append to `DEPLOY_PACKAGES` in `.env` (+ `.env.example` if listed there).
      (`db/db-config.ts` since removed — `.env` is the single deploy list.)

### Phase 3 — PostGraphile exposure
- [x] Add `location_datasets` + `location_datasets_api` to `graphile.config.ts` `schemas`
      (follow the house pattern for which of the trio get exposed — check how `loc`/`todo` do it).
- [x] Verify in GraphiQL: `brewery(id)`, `searchBreweries`, `breweryMapPoints`,
      `brewerySyncStatus` present with expected inflected names; no insert/update mutations.

### Phase 4 — Workflow (`sync-workflow.data.md`)
- [x] Handler `apps/worker-app/server/lib/worker-task-handlers/location-datasets/sync-breweries.ts`
      (wrapped in `_workflowHandler`); register `'sync-breweries'` in the taskList.
- [x] Template seed for the anchor tenant — **inline block in `db/seed.sql`** mirroring the
      wf-exerciser `wf_fn.upsert_wf` block (planning correction: the
      `load-workflow-*.sql`-next-to-handler mechanism is stale; its `migrate-entrypoint.sh`
      reference is commented out).

### Phase 5 — types + GraphQL client (`_shared.data.md` §fnb-types, §GraphQL Client Setup)
- [x] `Brewery` / `BreweryType` / `BreweryMapPoint` / `BrewerySyncStatus` in `fnb-types`
      (UPPERCASE enum values verbatim); barrel-export.
- [x] Fragments (full field expansion) + queries under
      `src/graphql/locationDatasets/`; codegen; mapper `src/mappers/brewery.ts`.
- [x] Composables `useBreweries` / `useBrewery` / `useBreweryMapPoints` + package index exports
      + tenant-app re-exports. `pnpm build` green.

### Phase 6 — Pages + components (`index.*`, `[id].*`)
- [x] `pages/datasets/breweries/index.vue` + `BreweryListView.vue` / `BreweryMapView.vue`
      (components dir `datasets/`); `pages/datasets/breweries/[id].vue`.
- [x] Icon check (UC11): `i-lucide-database`, `i-lucide-beer`, `i-lucide-refresh-cw`,
      `i-lucide-external-link`, `i-lucide-arrow-left` all exist; tenant-app already declares
      `@iconify-json/lucide` (memory `iconify-collection-per-app`).

### Phase 7 — Nav (`_shared.data.md` §Navigation)
- [x] `datasets` module + `tenant-datasets-breweries` tool in
      `db/fnb-app/deploy/00000000010240_app_fn.sql`; goes live on DB reseed (rebuild).

### Phase 8 — End-to-end verification
- [x] Ask the user to rebuild (memory `rebuild-ask-user`); verify read-only after.
- [x] As super-admin `bucket@`: empty state renders → sync queues → workflow visible in the
      Workflow Dashboard → status line flips in-progress → completes with ~11.7k rows.
- [x] Re-invoke sync: counts stable, `updated_at` bumps, no duplicates (upsert path).
- [x] As a plain `p:app-user` (spot-check `p:app-admin` too): list/filters/pagination, map clusters + popup + US default +
      ungeocoded note, detail page (geocoded + ungeocoded records), **no sync button**.
- [ ] RLS spot-checks: brewery rows and their public locations readable cross-tenant; tenant
      locations still invisible cross-tenant; no write path via GraphQL.

### Phase 9 — Spec reconcile + skill
- [x] Fold implementation corrections back into these spec files; flip Status lines to
      `Implemented — GraphQL`.
- [x] **Kickoff `/fnb-acquire-dataset`** with the user: distilled into
      `.claude/skills/fnb-acquire-dataset/SKILL.md` (designed with the user 2026-07-09);
      registered in `.claude/skills/skill-map.md` + the `/fnb` menu (R21).

## Remaining Open Questions

**None — both resolved 2026-07-09 during implementation planning** (details + evidence in
`_shared.data.md` §Open Questions and the plan file):

1. **`in_progress` detection** — resolved: non-terminal = root `type='wf'` uow status in
   (`incomplete`, `paused`, `waiting`, `trigger_set`).
2. **`wf_api.queue_workflow` gating** — resolved by user decision: it carries **no** gate today;
   the sync trigger ships UI-gated only, and the API-level template gate is deferred to issue
   `0030__wf________wf-rls-missing` (holistic wf permissions).

## Considered & rejected

- **Schema named `brews`** — the user's opening idea; renamed `location_datasets` to make the
  module a general home for location-backed datasets (and the future `/fnb-acquire-dataset`
  skill's target).
- **Nullable-tenant "global rows"** and a **dedicated system tenant** for the location rows —
  rejected in favor of `is_public` + anchor-tenant ownership: no orphan tenancy semantics, and
  the flag generalizes to any future public dataset.
- **Denormalizing address fields onto `brewery`** — rejected; the `loc.location` FK was a core
  requirement and keeps geo data queryable alongside tenant locations.
- **Fan-out workflow (one UOW per API page)** — rejected; dynamic UOW creation is new machinery
  and the whole walk takes minutes. Single task, single retry unit.
- **A delete/tombstone pass for records removed upstream** — rejected; upstream marks closures
  via `brewery_type = 'closed'`, and stale rows are acceptable for a reference dataset.
- **Any-user sync trigger** — rejected; polite use of a volunteer-run API means site-admin only.
