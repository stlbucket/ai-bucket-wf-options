---
name: fnb-acquire-dataset
description: >
  Acquires an external public/API dataset into the fnb stack: point it at an API (or its
  documentation) and a main-table name, and it drives recon → a <dataset>-expert skill → a full
  spec (via fnb-stack-spec) → a plan file → implementation hand-off (fnb-stack-implementor) for
  the whole shape: dataset table(s) + public loc.location rows + sync-<name> wf workflow +
  Datasets tool with list/(map)/detail. Triggers include: "/fnb-acquire-dataset <url> <table>",
  "acquire a dataset", "import a public dataset", "add a dataset to the Datasets module", or
  "do what we did for breweries with X". The breweries dataset is the canonical pattern.
---

# fnb Acquire Dataset

Reproduce the **breweries shape** for a new external dataset. Breweries is the canonical,
simplest case — its spec dir (`.claude/specs/tenant-app/datasets/breweries/`) is the structural
template, and its README's *Locked decisions* + implementation corrections are the default
answers.

This is a **top-level skill** (Tier 0 in `.claude/skills/skill-map.md`): the user invokes it
directly, and it **implicitly invokes `fnb-stack-spec`** to author the spec (Phase 2) and hands
the plan to `fnb-stack-implementor` (Phases 3–4) — the user never has to call those themselves.
It owns the **acquisition sequence** only; the stack itself is described in the pattern files
and executed by the two orchestrators (R21 — no restating here).

## Inputs (ask for whichever is missing)

1. **API / API-documentation URL** — the upstream source.
2. **Main table name** — the dataset's primary entity (e.g. `brewery`).

---

## Phase 0 — Recon (produce the `<dataset>-expert` skill)

Fetch the documentation **and live-probe the API** before designing anything. The docs lag the
data (learned live: Open Brewery DB's docs listed 10 `brewery_type` values; the data had 14 —
the first sync died on undocumented `taproom`).

Recon checklist — record every answer in a new `.claude/skills/<dataset>-expert/SKILL.md`
(shape: `breweries-expert`):

- **Access**: none / API key / OAuth? Which header/param carries the key? Rate limits, SLA,
  politeness posture (volunteer-run → sequential requests, no client-side loops).
  **Keys are env-only**: pick a `<NAME>_API_KEY` var; add it to `.env` (real value — user
  supplies), `.env.example` (placeholder), and the **n8n** service env in
  `docker-compose.yml` (or an `n8n/credentials/*.tpl` credential) — optional `${VAR:-}` unless the
  sync cannot run without it; the `sync-<name>` n8n workflow reads it. The spec
  and the expert skill record the var *name*, never a value.
- **Entities**: how many logical tables does the data imply? Relations between them?
- **Pagination**: page/per_page, cursor, or offset? Max page size? Where does the total count
  come from (meta endpoint, headers, or "walk until empty")?
- **Live schema**: fetch one page + one record; record the *actual* field list, nullability in
  practice, deprecated duplicates, and types (numbers-or-null, stringly numbers, etc.).
- **Enum-ish fields**: get the **live vocabulary** (aggregate/meta endpoints when available,
  else scan a sample). Flag every enum as *open* — expect new values to appear.
- **Geo shape**: lat/lon? addresses? → decides the `loc.location` split and whether the tool
  gets a map view. Note how many records are ungeocoded.

Register the new expert skill: one row in `.claude/skills/skill-map.md` (technology references)
and a menu entry in `.claude/skills/fnb/SKILL.md` (R21).

## Phase 1 — Decisions with the user

Walk these explicitly (AskUserQuestion); breweries' answers are the defaults:

| Decision | Default | Ask because… |
|---|---|---|
| Schema placement | `location_datasets` (existing package, next `107xx` change numbers) | **always confirm** — and if recon found **more than 3 tables**, propose a dedicated schema + `db/fnb-<name>` package (`/new-db-package`, next free `10N00` range) instead |
| Location rows | geo-bearing datasets FK to public `loc.location` rows (anchor tenant, `resident_id` null, `is_public` true) | non-geo datasets skip the loc split *and* the map view |
| Read access | `p:app-user` or `p:app-admin` (`jwt.enforce_any_permission`), RLS `using (true)` reads, **no write path via API** | dataset may warrant narrower access |
| Sync trigger | `p:app-admin-super`, UI-gated button (API-level wf gate is issue 0030) | paid/keyed APIs may allow looser triggering |
| Import scope | everything, no delete pass; re-invocation = the refresh *and* retry story | huge datasets may need filters or a fan-out workflow |
| Workflow shape | single `sync-<name>` task (one retry unit) | fan-out only if a full walk substantially exceeds minutes |
| Views | list + detail; map only if geocoded (clustered, US default viewport) | dataset-specific visualizations |
| Enum posture | every enum column carries an `'unknown'` sentinel + `notes text`; the upsert coerces unrecognized values against `pg_enum` and records the raw value | non-negotiable — this is the drift armor |

## Phase 2 — Spec (implicitly invoke `fnb-stack-spec`)

**Invoke `fnb-stack-spec` (Mode 2) now** — read its SKILL.md and author the spec under its
rules; do not write spec files freehand. Target: `.claude/specs/tenant-app/datasets/<name>/`
mirroring the breweries dir **file for file**: `README.md` (required index with the leading
Execution Directive: Status, Locked decisions, task list, Considered & rejected),
`_shared.data.md`, `sync-workflow.data.md`, `index.ui.md`, `index.data.md`, `[id].ui.md`,
`[id].data.md`. Copy the *shape*, not the content. Statuses start `Draft`; no `[FILL IN]` may
survive Phase 1's decisions. `fnb-stack-spec`'s own hand-off question (yes/no: invoke the spec
so a plan gets made?) is the gate into Phase 3.

## Phase 3 — Plan

One numbered plan file in `.claude/issues/identified/` per R23 (category `loc` or the dataset's
own), with a self-referential Execution Directive → `/fnb-stack-implementor <this-file>`, and
the breweries plan (`0010__loc_______breweries-dataset…`) as the sequencing template — including
its **user rebuild gate** placement (all sqitch/seed/nav SQL before the gate; codegen after).

## Phase 4 — Implementation hand-off + expected hiccups

`/fnb-stack-implementor` runs the plan. **Expect the import to hiccup** — these are the known
classes (all hit or armored against during breweries):

| Hiccup | Armor |
|---|---|
| Docs lag the data (enum values, absent fields) | Phase 0 live probe; `unknown` + `notes` coercion; a failed sync is loud (workflow ERROR) and re-queue re-walks idempotently |
| Upstream nulls / stringly types | nullable-everything columns; text lat/lon; mappers coerce at the client edge |
| PostGraphile inflection surprises (`…OptionInput` singularized, arg named `_options`) | verify names in GraphiQL post-rebuild *before* writing `.graphql` documents |
| Page 500s under SSR | `'/datasets/**': { ssr: false }` routeRule already covers the module in tenant-app |
| Map pins invisible | theme colors are `oklch(...)` — resolve via probe element (UC6) |
| Partial walk after mid-sync failure | upserts are idempotent; admin re-queues; counts verify against the upstream total afterward |

Verification mirrors breweries README Phase 8: sync completes with the upstream total, re-sync
is stable, plain-user RLS reads work, no write mutations exist.

## Related skills

- `fnb-stack-spec` / `fnb-stack-implementor` — the orchestrators this skill drives
- `new-db-package` · `sqitch-expert` · `fnb-db-designer` — DB mechanics when a dedicated
  schema/package is chosen
- `n8n-cli` — the workflow engine (R22): the `sync-<name>` n8n workflow is the sync task handler
- `breweries-expert` — the canonical dataset expert skill this pattern produced
