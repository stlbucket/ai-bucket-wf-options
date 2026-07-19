# Plan: Breweries dataset — `location_datasets` module, public locations, sync workflow, list/map/detail UI

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/tenant-app/datasets/breweries/` (README + `_shared.data.md`
> + `sync-workflow.data.md` + `index.*` + `[id].*`) — this plan sequences it and records the two
> resolved Open Questions; it does not restate the spec (R21). Specialist skills:
> `new-db-package` (Phase 2), `sqitch-expert` (all DB phases), `fnb-db-designer` (RLS/grants),
> `postgraphile-5-expert` (Phase 5), `graphile-worker-expert` (Phase 4), `breweries-expert` (API
> facts). Never run `git` in a sqitch session; never rebuild/restart the env yourself — ask the
> user (memory `rebuild-ask-user`), then verify read-only.

**Severity: MED** (feature work — the active exercise) · Workstream: datasets · Planned: 2026-07-09
· Spec status: Draft, no `[FILL IN]`s; both Open Questions resolved below.

## Context

First tool of the new **Datasets** module: read-only public dataset of ~11,700 Open Brewery DB
records. New sqitch package `db/fnb-location-datasets` (`location_datasets` schema trio), public
`loc.location` rows (`is_public`, anchor-tenant-owned, `resident_id` null), a single-task
`sync-breweries` wf workflow run by worker-app, and a tenant-app list/map/detail UI. All design
decisions are locked in the spec README (`Locked decisions` #1–17). This exercise culminates in
the `/fnb-acquire-dataset` skill (Phase 8 — with the user).

## Resolved Open Questions (verified against source 2026-07-09)

### OQ1 — `in_progress` status vocabulary ✅

`db/fnb-wf/deploy/00000000010500_wf.sql`: `wf.uow_status_type` =
`incomplete · paused · waiting · complete · canceled · deleted · error · template · trigger_set`.
Instance status = the root `type = 'wf'` uow's status (`wf.wf_status(_wf)` reads exactly that row).

So `brewery_sync_status().in_progress` =

```sql
exists (
  select 1 from wf.wf w
  join wf.uow u on u.wf_id = w.id and u.type = 'wf'
  where w.identifier = 'sync-breweries'
    and w.is_template = false
    and u.status in ('incomplete', 'paused', 'waiting', 'trigger_set')
)
```

(`location_datasets_fn` is SECURITY DEFINER, so reading `wf.*` cross-schema is fine.)

### OQ2 — `wf_api.queue_workflow` gating ✅ — **it has none; deferred to issue 0030**

Verified in `db/fnb-wf/deploy/00000000010520_wf_fn.sql` + `00000000010580_wf_policies.sql`:

- `wf_api.queue_workflow` is `SECURITY DEFINER` (house-pattern deviation — INVOKER expected) and
  performs **no** `jwt.enforce_permission` call.
- Grants are wide open: `grant all on all routines in schema wf_api to anon, authenticated, service_role`.
- `wf_fn.clone_wf_template`'s tenant filter is **commented out** (`-- tenant_id = _tenant_id`,
  line ~791) — templates resolve **globally by identifier**, so seeding `sync-breweries` for the
  anchor tenant only does *not* restrict who can queue it. Any authenticated user in any tenant
  could trigger a sync against the volunteer-run upstream API.

**Resolution (user decision 2026-07-09): no API-level guard in this feature.** The gap is recorded
in `0030__wf________wf-rls-missing__________________CRT__.plan.md` (Details addendum + Suggested
fix #6, with the `required_permission_key` sketch) and will be addressed when wf permissions are
handled holistically. Until then the `sync-breweries` trigger is **UI-gated only** (button hidden
without `p:app-admin-super`) — an accepted interim state, contra R12/R13; nothing extra to build
here.

## Spec corrections found during planning

1. **Template seeding mechanism** (spec decision #8 says "`load-workflow-sync-breweries.sql` next
   to the handler, referenced from `db/seed.sql`"): the *actual* current mechanism is an **inline
   block in `db/seed.sql`** calling `wf_fn.upsert_wf(row(...)::wf_fn.wf_info, <anchor tenant id>)`
   (see the wf-exerciser block, `db/seed.sql:125+`). The `load-workflow-exerciser.sql` file next
   to the handler is stale (the `migrate-entrypoint.sh:47` reference is commented out and points
   at the retired graphql-api-app path). **Do the inline seed block**; fold this correction into
   the spec at Phase 8.
2. **`db/db-config.ts` does not exist** — README Phase 2's "and `db/db-config.ts` if package lists
   exist there" is a no-op. `DEPLOY_PACKAGES` lives in `.env:17` and `.env.example:42` only.
3. `loc.location.resident_id` FKs `loc.loc_resident(resident_id)` (not `app.resident`) — dropping
   NOT NULL is sufficient; the FK stays and null passes it.

## Implementation phases

Follows the spec README task list; enriched with verified anchors. **`pnpm build` is the gate**
(repo lint is broken). No new npm dependencies anywhere (mapbox + urql already present) — R24/
catalog untouched.

### Phase 1 — `fnb-loc`: public locations
- New change `00000000010340_loc_public_locations` (deploy/revert/verify + plan entry, dep on
  `00000000010300_loc`): `is_public boolean not null default false`, `resident_id` drop not null,
  `view_public` SELECT policy `using (is_public = true)`. SQL verbatim in `_shared.data.md` §DB 1.

### Phase 2 — new package `db/fnb-location-datasets`
- Scaffold via `/new-db-package` (registers in `DEPLOY_PACKAGES` — confirm it edits both `.env`
  and `.env.example`; append after `fnb-storage`).
- Changes per `_shared.data.md` §DB 2 (schemas/enum/table `10700`, `_fn` `10710`, `_api` `10715`,
  policies `10720`). Cross-project deps: `fnb-loc:00000000010340_loc_public_locations`,
  `fnb-app:00000000010250_app_policies`. `search_breweries` paging uses the existing
  `app_fn.paging_options` (`db/fnb-app/deploy/00000000010230_app_fn_types.sql:74`).
- `brewery_sync_status()` uses the OQ1 predicate above. No write `_api` fns, no write policies;
  `upsert_breweries` is `_fn`-only (worker root-of-trust).

### Phase 3 — worker handler + seeds
- Handler `apps/worker-app/server/lib/worker-task-handlers/location-datasets/sync-breweries.ts`
  wrapped in `_workflowHandler` (contract verified: receives `{ uow, workflowData }`, returns
  `{ status: 'complete', stepData, workflowData }` or `{ status: 'error', errorInfo }`; wrapper
  already schedules follow-ons with `maxAttempts: 1` — add nothing). Register
  `'sync-breweries'` in `server/lib/worker-task-handlers/index.ts` taskList (stack-unique key).
- Pagination walk + error posture per `sync-workflow.data.md` (sequential, `per_page=200`,
  `/breweries/meta` → total; API facts: `breweries-expert` skill). DB via `useFnbPgClient()`,
  one `select location_datasets_fn.upsert_breweries($1::jsonb)` per page.
- `db/seed.sql`: inline `sync-breweries` template block (root `type='wf'` uow +
  `sync-breweries` task uow, `useWorker true`, edge direction mirroring the wf-exerciser block;
  no input_definitions).

### Phase 4 — PostGraphile exposure
- Add `location_datasets`, `location_datasets_api` to `schemas` in
  `apps/graphql-api-app/server/graphile.config.ts:29` (matches the `loc`/`todo` pattern: base +
  `_api`, never `_fn`).

### ⏸ USER REBUILD GATE
Everything above lands only on rebuild (new sqitch packages + seed; memory `rebuild-wipes-db`).
**Ask the user to run it.** Then verify read-only in GraphiQL: `brewery(id)`,
`searchBreweriesList`, `breweryMapPointsList`, `brewerySyncStatus`, `BreweryType` enum
(UPPERCASE values) present; **no** brewery insert/update/delete mutations; exact inflected
field/relation names recorded for the `.graphql` documents (e.g. the brewery→location relation
name under PgSimplifyInflection).

### Phase 5 — fnb-types + graphql-client-api
- `packages/fnb-types`: `Brewery` / `BreweryType` / `BreweryMapPoint` / `BrewerySyncStatus` per
  `_shared.data.md` §fnb-types (enum values verbatim UPPERCASE; `location: Location` reuses the
  existing loc type) + barrel line.
- Fragments/queries under `src/graphql/locationDatasets/` (full field expansion — memory
  `fragments-all-fields`); codegen (`pnpm -F @function-bucket/fnb-graphql-client-api generate`);
  mappers `src/mappers/brewery.ts` (`toBrewery`, `toBreweryMapPoint` — lat/lon `parseFloat`,
  `toBrewerySyncStatus`).
- Composables `useBreweries` (options ref + syncStatus + `queueSync` wrapping the existing
  `useQueueWorkflow`/`queueWorkflow` mutation + ~10s polling while `inProgress`, per
  `index.data.md`), `useBrewery`, `useBreweryMapPoints` (paused until map activated).
- **Barrel** `src/index.ts` (the #1 miss) + tenant-app thin re-exports
  (`apps/tenant-app/app/composables/useBreweries.ts` etc.). `pnpm build` green.

### Phase 6 — pages + components + nav
- `apps/tenant-app/app/pages/datasets/breweries/index.vue` + `[id].vue`,
  `app/components/datasets/BreweryListView.vue` / `BreweryMapView.vue` — per `index.ui.md` /
  `[id].ui.md` (Nuxt UI **v4** only, UC13 `TableColumn`/`row.original`; UC4/5/6/7/12; type-badge
  color map from `index.ui.md`; map defaults center `[-98.5795, 39.8283]` zoom 3.5, clustered).
- Icons (UC11): `i-lucide-database`, `i-lucide-beer`, `i-lucide-refresh-cw`,
  `i-lucide-external-link`, `i-lucide-arrow-left` — verify each exists before use.
- Nav (R14): add the `datasets` module (+ `tenant-datasets-breweries` tool,
  `/tenant/datasets/breweries`, `p:app-user` + `p:app-admin` on both module and tool rows —
  read access is `jwt.enforce_any_permission(['p:app-user','p:app-admin'])` in `_api`) as a
  `module_info` row in
  `db/fnb-app/deploy/00000000010240_app_fn.sql` — mirror the `tools` module block (~line 350)
  and confirm which `install_*_application` block(s) drive customer-tenant nav (todo/loc
  precedent) so the module shows for all tenants, not just anchor. Goes live on the next reseed —
  if the rebuild already happened, ask the user for one more (or accept nav lands with the final
  rebuild; sequence this phase's SQL edit **before** the rebuild gate if possible — preferred
  order: do this edit in Phase 1–3's sqitch window).

### Phase 7 — end-to-end verification (read-only; user runs any rebuild/restart)
Per spec README Phase 8: as `bucket@` (super-admin) — empty state → sync queues → instance in
Workflow Dashboard → status line in-progress → completes ~11.7k rows; re-invoke → counts stable,
`updated_at` bumps, no dupes. As plain `p:app-user` (spot-check `p:app-admin`) — list/filters/pagination, map
clusters/popup/US default/ungeocoded footnote, detail (geocoded + ungeocoded), **no sync button**
(UI gate only — the API-level gate is deferred to issue 0030, see OQ2). RLS spot-checks per spec.

### Phase 8 — spec reconcile + `/fnb-acquire-dataset` kickoff
- Fold corrections (this plan's "Spec corrections" + anything found in 5–7) back into the spec
  files, including the OQ2 deferral (spec `_shared.data.md` Open Question 2 → resolved as
  "UI-gated only; API gate tracked in issue 0030"); flip Status lines to `Implemented — GraphQL`.
- Kick off the `/fnb-acquire-dataset` skill design **with the user** (memory
  `acquire-dataset-skill`); register in `.claude/skills/skill-map.md` (R21).
- Ask the user before moving this plan to `addressed/` (memory `ask-before-moving-addressed`).

## Sequencing summary

1. Phases 1–4 + Phase 6's nav SQL edit (sqitch sessions — no `git`) → **user rebuild** →
   GraphiQL verify → Phase 5 (codegen needs the live schema) → Phase 6 UI (hot-reloads;
   packages-watch rebuilds graphql-client-api/fnb-types) → Phase 7 → Phase 8.
2. Two user touchpoints: the rebuild, and sign-off at Phase 8.

## Post-implementation addendum (2026-07-09 — executed; spec is the source of truth)

Implemented and verified same day: 11,745 breweries, no dupes, list/map/detail live. Corrections
discovered in flight are folded into the spec files (see the spec README Status). Beyond the
plan: upstream `brewery_type` drift handling (`unknown` sentinel + `notes` column + `pg_enum`
coercion in `upsert_breweries` — first sync failed on undocumented `taproom`), permissions
widened to `p:app-user`/`p:app-admin` (`jwt.enforce_any_permission`), `fnb-loc:00000000010350`
`is_geolocated` generated column + "Geocoded only" search toggle (user request), the Mapbox
`oklch(...)` color fix (UC6 note in `ui-components-rules.md`), and `'/datasets/**': { ssr:
false }` in tenant-app routeRules. R21 propagation done: CLAUDE.md + monorepo-bootstrap +
graphql-api-pattern + sqitch-expert/new-db-package/fnb-db-designer/fnb-stack-implementor/
legacy-ui-converter skills now list the eighth package + exposed schemas. Remaining Phase 8
item: the `/fnb-acquire-dataset` skill design with the user.

## Out of scope / linked

- **API-level gating of `queueWorkflow('sync-breweries')`** — deferred by user decision to
  `0030__wf________wf-rls-missing__________________CRT__.plan.md` (holistic wf permissions);
  the OQ2 findings + `required_permission_key` sketch are recorded there.
- `0020` fn-schema grant bypass — pre-existing, tracked separately.
- `wf_api.queue_workflow` being SECURITY DEFINER (house-pattern deviation) — folded into 0030.
- Delete/tombstone pass, fan-out workflow, per-user sync — explicitly rejected in the spec.
