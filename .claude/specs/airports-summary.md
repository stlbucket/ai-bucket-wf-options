# Adding the OurAirports dataset with `/fnb-acquire-dataset`

A walkthrough of how the **Airports** dataset tool was built, written for a colleague who wants
to understand the `/fnb-acquire-dataset` workflow: how it was invoked, which decisions it asked
for, and what had to be customized because this dataset is quite different from the canonical
example (breweries).

**What got built:** a read-only, public **Airports** tool under the Datasets module —
~85,700 world airports plus runways, radio frequencies, navaids, and country/region lookups,
imported from OurAirports, browsable as a filterable list, a clustered map, and a detail page
with child tables. Source of truth for the design lives in
`.claude/specs/tenant-app/datasets/airports/`.

---

## How the skill was invoked

```
/fnb-acquire-dataset https://ourairports.com/airports.html airport

there is no api documentation for this one - but i bet you can figure out
how to query all the data...
```

Two positional arguments: **the source URL** and **the main table name** (`airport`). The note
about "no API documentation" was the important hint — it told the skill not to go looking for an
API contract and to instead figure out the access model from the site itself.

`/fnb-acquire-dataset` is a **Tier-0 orchestrator**. You invoke it directly; it does the recon
and the user-facing decisions itself, then **implicitly chains** the two workhorse skills so you
never call them by hand:

```
/fnb-acquire-dataset
   ├─ Phase 0  recon → writes a <dataset>-expert skill
   ├─ Phase 1  decisions with you (AskUserQuestion)
   ├─ Phase 2  fnb-stack-spec   (authors the spec)
   ├─ Phase 3  fnb-stack-implementor  (derives the plan)
   └─ Phase 4  fnb-stack-implementor  (executes the plan)
```

The whole thing is modelled on the **breweries** dataset (the first one built this way), which
serves as a file-for-file structural template. The interesting part of this run is everywhere
airports had to *diverge* from that template.

---

## Timeline: every prompt, and what happened after it

### Prompt 0 — the invocation (above)

**What Claude did (Phase 0 — recon, no prompt needed):** the note said there's no API, so the
first job was to find the real access model. Fetching `ourairports.com/data/` revealed the
answer: **OurAirports has no query API at all.** The entire database is published nightly as
**seven bulk CSV files on GitHub Pages** (`davidmegginson.github.io/ourairports-data/`),
public-domain, no key, no rate limits.

Rather than trust the site's data dictionary, Claude **downloaded all seven CSVs and profiled
them live** — row counts, real column lists, enum vocabularies, nullability, referential
integrity, and HTTP caching headers. That live probe is the reason several later design choices
are correct. Key findings:

- **No API** → the sync is "download the whole file and upsert," not "paginate an endpoint."
- **The data dictionary lies:** it documents an airport type `closed_airport`; the live data
  says `closed` (13,331 rows). Trusting the docs would have broken the first sync.
- **`surface` (664 distinct values) and frequency `type` (549 distinct)** are free text in
  practice, despite the docs implying fixed vocabularies — so they must be `text`, not enums.
- **Airports are 100% geocoded** (0 of 85,716 missing coordinates).
- **`usageType`** is the one camelCase column header in an otherwise snake_case dataset.
- The files ship **`ETag` / `Last-Modified` headers** → conditional GET is possible, which
  makes re-syncs nearly free.

Claude captured all of this in a new expert skill,
`.claude/skills/airports-expert/SKILL.md`, and registered it in `skill-map.md` and the `/fnb`
menu. That skill is now the durable, reusable reference for anyone touching this data.

### Prompt 1 — Phase 1 decisions (`AskUserQuestion`, 4 questions)

The skill surfaced the four decisions where airports could reasonably differ from the breweries
defaults, each with a recommendation:

| Question | Answer chosen | Why it mattered |
|---|---|---|
| **Schema placement** | **Dedicated `db/fnb-airports` package** | Recon found **6 tables**. The skill's rule is ">3 tables ⇒ its own package," so airports got its own schema instead of sharing breweries' `location_datasets`. |
| **Import scope** | **All six CSVs** (airports, runways, frequencies, navaids, countries, regions) | Committed to a multi-table import (~180k rows), skipping only the free-text `airport-comments.csv`. |
| **`loc.location` rows** | **All airports** get a public location row | Reuses the `is_public` mechanism breweries added — no new `fnb-loc` change needed this time. |
| **Everything else** | **Accept breweries defaults** | Access model, sync trigger, enum drift-armor, and the list/map/detail views all follow the established pattern. |

**What Claude did after:** proceeded to Phase 2 with those decisions locked.

### Prompt 2 — spec hand-off (`AskUserQuestion`, yes/no)

Phase 2 invoked **`fnb-stack-spec`** (Mode 2), which authored the spec directory
`.claude/specs/tenant-app/datasets/airports/` mirroring the breweries spec **file for file**:
`README.md` (the index, with locked decisions and a phased task list), `_shared.data.md` (the
data model), `sync-workflow.data.md`, and the `index.*` / `[id].*` UI+data pairs. The spec was
written with zero `[FILL IN]` markers because Phase 1 had resolved every open decision.

The skill then asked, explicitly: **"The spec is complete. Invoke it now so a plan gets
made?"** → **Yes.**

**What Claude did after:** handed the spec's README to the implementor.

### Prompt 3 — plan go/no-go (`AskUserQuestion`, yes/no)

Phase 3 invoked **`fnb-stack-implementor`** against the spec README. It first *verified live code
anchors* (the seed file, the PostGraphile config, the worker task list, the deploy-package env
var) and then **derived a numbered plan file** following the R23 naming convention, using the
breweries plan as the sequencing template:

```
.claude/issues/identified/0010__loc_______airports-dataset________________MED__.plan.md
```

The plan places a **user rebuild gate** in the middle: all SQL (sqitch, seed, nav) and the worker
handler land *before* the gate; GraphQL codegen and the UI land *after* (codegen needs the live
schema). Then: **"Plan created. Execute it now?"** → **Yes.**

**What Claude did after:** moved the plan to `in-flight/` and executed everything up to the
rebuild gate:

- **DB package** `db/fnb-airports` — four sqitch changes (`10800` tables/enums, `10810` `_fn`
  logic, `10815` `_api` surface, `10820` grants+RLS), each with deploy/revert/verify. Registered
  in `DEPLOY_PACKAGES`.
- **Seed + nav + exposure** — the `sync-airports` workflow template seeded in `db/seed.sql`, the
  `tenant-datasets-airports` nav tool added to the existing Datasets module, and the `airports` /
  `airports_api` schemas added to the PostGraphile config.
- **Worker handler** — `apps/worker-app/.../airports/sync-airports.ts` plus the new `csv-parse`
  dependency.
- Built `worker-app` and `graphql-api-app` green, then **stopped at the rebuild gate** and asked
  the user to rebuild (per house rule: never rebuild the environment yourself).

### (Between prompts) — model switch + "continue"

The user rebuilt the environment, switched the model to Opus 4.8, and typed **`continue`**.

**What Claude did after:** confirmed the rebuild had happened (containers up, all four sqitch
changes deployed, schemas/tables/RLS/template/nav all present, tables empty), then did the
critical post-rebuild step — **introspected the live GraphQL schema** to confirm the
PostGraphile-inflected names before writing any `.graphql` documents (this is where breweries had
surprises). Everything matched: `searchAirportsList`, `airportMapPointsList`, `airportSyncStatus`,
`airport(id)`, the child relations (`runwaysList`, `airportFrequenciesList`,
`navaidsByAssociatedAirportIdList`), the `_options` input arguments, and enum spellings like
`NDB_DME`. It also confirmed **no mutations exist** for any airports table (read-only by design).

Then it executed the post-gate phases: `fnb-types` entity types → fragments/queries → codegen →
mappers → three composables → barrel export → app re-exports → list/map/detail pages and
components. The **full `pnpm build` gate passed (12/12)**, and it verified the worker task was
registered and `csv-parse` resolves at runtime.

### Prompt 4 — how to run the first sync (`AskUserQuestion`)

With all code done and verified read-only, the only thing left was Phase 6: actually running a
sync and eyeballing the UI (which needs a browser + super-admin login the agent can't drive).
Claude asked whether to **drive the sync itself** (enqueue it and verify row counts) or leave it
to the user. → **"I'll run it via the UI."**

**What Claude did after:** stayed hands-off on triggering the sync, and handed over a UI
verification checklist.

### Prompt 5 — "i have verified thru the ui - finish your reconciliation"

The user ran the sync as super-admin and checked the views. **What Claude did after (Phase 7 —
reconcile):** captured the actual sync results from the DB (all counts matched recon exactly;
zero unexpected enum coercions), folded every implementation delta back into the spec files and
flipped their statuses to `Implemented — GraphQL`, resolved both Open Questions with the live
evidence, updated the `airports-expert` skill with what the full import confirmed (including
that upstream ETags are weak `W/"…"` values), wrote a post-implementation addendum into the
plan file, and did the **R21 propagation** — CLAUDE.md, `monorepo-bootstrap-pattern.md`,
`graphql-api-pattern.md`, and five specialist skills now list the ninth sqitch package, the new
exposed schemas, and the next free change-number range. One item left honestly unchecked in the
spec: the ETag-`304` re-sync path is armed but won't be exercised until the next sync runs.

---

## What had to be customized for this dataset

The breweries pattern is a paginated JSON API feeding one table. Airports is a very different
shape, so most of the real work was in the divergences:

1. **No API → a bulk-CSV sync.** The worker handler downloads six whole CSV files in dependency
   order (countries → regions → airports → runways → frequencies → navaids), stream-parses each
   with `csv-parse`, and upserts in 1,000-row chunks. This is a fundamentally different handler
   from breweries' page-walking loop.

2. **Conditional-GET re-syncs.** A small `airports.sync_source` bookkeeping table stores each
   file's `ETag`. On re-sync the handler sends `If-None-Match`; an unchanged file returns `304`
   and is skipped. Re-running a sync the same day is nearly free — a customization made possible
   by recon spotting the cache headers.

3. **A dedicated `db/fnb-airports` package** (six tables + a bookkeeping table) instead of
   extending the shared `location_datasets` schema — triggered by the ">3 tables" rule.

4. **A generic enum-coercion helper.** Breweries coerced one enum inline. Airports has **five**
   enums across three tables, so the drift-armor was factored into a reusable
   `airports_fn.coerce_enum_label(enum_type, raw)` that every upsert calls — unrecognized values
   become `'unknown'` and the raw value is recorded in the row's `notes`. Recon had already
   proven this was necessary (`closed_airport` vs `closed`).

5. **Free-text columns, not enums.** `runway.surface` and `airport_frequency.type` are `text`
   because the live scan found 664 and 549 distinct values — the docs' "allowed values" lists
   were fiction.

6. **A richer detail page with child tables.** Airports own runways, frequencies, and associated
   navaids, so the detail query pulls those child relations and the page renders three sub-tables.
   Breweries had no children.

7. **Map payload discipline.** ~72k geocoded airports (vs breweries' ~11k) meant the map query
   **excludes `closed` airports by default**, with an "Include closed on map" toggle — a
   dataset-specific control that doesn't exist for breweries.

8. **A new npm dependency** (`csv-parse`) added to `worker-app` — breweries needed none, since it
   consumed JSON.

9. **Complete `Runway` / `Navaid` types.** To honor the house "fragments select every field"
   rule, those two entity types carry all their columns rather than a lean subset.

Everything reused wholesale from breweries: the public-`loc.location` mechanism, the
`p:app-user`/`p:app-admin` read model with no API write path, the single-task `sync-*` workflow
triggered by a super-admin button, the `'/datasets/**': { ssr: false }` route rule, and the
Mapbox `oklch(...)`→`rgb()` probe fix for cluster colors.

---

## Outcome

**Shipped and verified (2026-07-10).** The operator ran the first sync through the UI and
confirmed the list/map/detail views. Results:

- **179,366 rows imported** across the six tables — 85,716 airports / 48,096 runways /
  30,312 frequencies / 11,009 navaids / 249 countries / 3,984 regions — every count matching
  the recon numbers exactly, plus 85,716 public `loc.location` rows.
- **Zero airports coerced to `unknown`** — the live-probed enum vocabulary was complete, which
  is exactly why recon profiles the data instead of trusting the docs. The only 31 coercions
  were the empty navaid `usageType`/`power` cells recon had already counted.
- **Every GraphQL name predicted by the spec matched the live schema** — no `.graphql` rework
  (the breweries run had inflection surprises; this one banked those lessons).
- Per-file ETags are stored, so the next re-sync exercises the free `304` skip path.

The spec is flipped to `Implemented — GraphQL` with all corrections folded in, and the R21
propagation is done (CLAUDE.md, the pattern files, and five specialist skills now list the
ninth sqitch package and the new exposed schemas).

**Where to look:**
- Dataset facts / access model → `.claude/skills/airports-expert/SKILL.md`
- Design + decisions + verified results → `.claude/specs/tenant-app/datasets/airports/`
  (start at `README.md`)
- The sequenced plan with its post-implementation addendum →
  `0010__loc_______airports-dataset________________MED__.plan.md` under `.claude/issues/`
