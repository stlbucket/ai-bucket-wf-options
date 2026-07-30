# Plan: db-introspect — psql-native DB structure docs + static tree browser

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/db-introspect/` (README + `db-structure.data.md` +
> `browser.ui.md`) — this plan sequences it with verified code anchors; it does not restate the
> spec (R21). No specialist skills needed: this is a host-side `db-*` script + a static HTML page
> — no sqitch, no GraphQL, no Nuxt. Never rebuild/restart the env yourself — the run itself is
> read-only against the dev DB. The user commits the output; never Claude (no `git`, ever).

**Severity: MED** (dev-tooling feature — spec'd and ready) · Workstream: db tooling ·
Planned: 2026-07-24 · Spec status: Draft, no `[FILL IN]`s, no blocking Open Questions.

## Context

One command — `pnpm db-introspect` → `scripts/db-introspect.ts` — captures the entire live fnb
DB structure as psql-native text files (one file per object) into `docs/db-structure/`, plus a
zero-dependency static `index.html` tree browser fed by a generated `db-structure.data.js`
rollup (`window.DB_STRUCTURE`). Output is committed so schema drift shows in PR diffs. All
design decisions are locked in the spec README (`Locked decisions` table); the capture contract
is `db-structure.data.md`, the browser page is `browser.ui.md`.

## Verified code anchors (2026-07-24)

- `scripts/_env.ts` exports `REPO_ROOT` (repo root via `import.meta.url`) and `PG_URL`
  (fail-fast from `.env`) — exactly what the spec says to import. No changes needed there.
- `scripts/db-exec.ts` is the house docker-psql pattern to mirror:
  `docker run --rm -i --network fnb-network … postgres:18 psql ${PG_URL} …` via
  `execSync(…, { stdio: 'inherit' })`. db-introspect adds the spec's
  `-v "${REPO_ROOT}/docs/db-structure:/out" -w /out` volume mount (relative `\o` paths land in
  the repo) plus `--no-psqlrc -v ON_ERROR_STOP=1`.
- Root `package.json` `scripts` block lists the family `"db-status": "tsx scripts/db-status.ts"`
  etc. (lines 10–17) — add `"db-introspect": "tsx scripts/db-introspect.ts"` there. `tsx` and
  `dotenv` are already root devDependencies (every sibling script uses them) — **no new npm
  dependencies**, R24/catalog untouched.
- `docs/db-structure/` does not exist yet — the script creates it; `index.html` is hand-written
  once in Phase 4 and preserved by every subsequent wipe.

## Implementation phases

Follows the spec README task list. **`pnpm build` is the gate** (repo lint is broken —
memory `project_eslint_broken`); a scripts-only change must not break it. No sqitch, no env
rebuild, no Docker restarts anywhere in this plan.

### Phase 1 — scaffolding
- `scripts/db-introspect.ts` (tsx; `import { PG_URL, REPO_ROOT } from './_env'`), flat in
  `scripts/` like its siblings.
- Root `package.json`: add `"db-introspect": "tsx scripts/db-introspect.ts"` alongside the
  other `db-*` entries.

### Phase 2 — inventory + capture (two psql calls total)
- **Inventory (psql call #1):** one `psql -tA` returning a single JSON document
  (`json_build_object`/`json_agg`) enumerating schemas, tables (`relkind IN ('r','p')`), views,
  matviews, foreign tables, sequences, functions (`prokind IN ('f','p')`, with oid +
  `pg_get_function_identity_arguments(oid)`), enums, standalone composite types, domains, and
  non-internal triggers — per the kind/source/fields table in `db-structure.data.md` Step 1.
  Common filters: schema `NOT LIKE 'pg\_%'` / `<> 'information_schema'`; **extension members
  excluded** via `pg_depend deptype='e'` (removes the ~93 pgcrypto/uuid-ossp/citext functions
  from `public`; ~272 real functions remain).
- **Wipe + mkdir (Node):** delete everything directly under `docs/db-structure/` **except
  `index.html`**; pre-create every directory the inventory requires (`\o` cannot mkdir).
  **Empty category directories are not created.**
- **Capture (psql call #2):** generate one psql script in the **session scratchpad** (never the
  repo) from the inventory and run it in a single docker-psql session with `ON_ERROR_STOP=1`:
  - `_overview/`: `\dn+` → `schemas.txt`, `\dx+` → `extensions.txt`, `\du+` → `roles.txt`,
    `\ddp` → `default-privileges.txt`.
  - Per schema (sorted): `\dp <schema>.*` → `grants.txt`; `\d+` per table/view/matview/sequence;
    `\dT+` per enum; `\d` per composite type; `\dD+` per domain;
    `SELECT pg_get_functiondef(<oid>);` → `functions/<name>.sql`;
    `SELECT pg_get_triggerdef(<oid>, true);` → `triggers/<table>__<trigger>.sql`.
  - Function/trigger sections bracketed with `\t on` + `\pset format unaligned` (restored after)
    so `.sql` files are bare source. Each function file leads with
    `-- <schema>.<name>(<identity args>)`.
  - **Overload naming:** same-name functions sorted by identity-argument string (stable) —
    first keeps `<name>.sql`, then `<name>__2.sql`, `<name>__3.sql`.
- **Manifest (Node):** `_overview/manifest.txt` — `generated-at` ISO timestamp (**the only
  timestamp anywhere in the output**), `database:` (PG_URL host/dbname, credentials stripped),
  per-kind counts.

### Phase 3 — rollup
- Walk the finished tree; emit `docs/db-structure/db-structure.data.js` as one
  `window.DB_STRUCTURE = {…}` assignment: `generatedAt`, `overview[]` (fixed order,
  manifest first), `schemas[]` (sorted; each with `name`, `grants`, non-empty `categories[]`
  in the fixed kind order tables → views → matviews → sequences → enums → types → domains →
  functions → triggers; items `{ name, file, content }` with repo-relative `file` paths).
  Plain `JSON.stringify`, ~1–3 MB, no chunking/compression. Everything sorted — deterministic
  reruns, clean diffs.
- Print per-kind counts + output root on success.

### Phase 4 — browser page (hand-written once, never regenerated)
- `docs/db-structure/index.html` per `browser.ui.md`: single file, vanilla JS + inline CSS,
  zero dependencies, data via `<script src="db-structure.data.js">` (works over `file://` —
  no fetch/CORS). **Nuxt UI rules UC1–UC12 do not apply** (spec scope note); keep the
  green/slate palette, light/dark via `prefers-color-scheme`.
- Layout: header (title, `generatedAt`, search) · left tree pane (~300px, own scroll;
  `_overview` pinned first; schema → category-with-count → leaf; `grants` a direct leaf under
  each schema) · right content pane (breadcrumb = repo-relative path, `<pre>` with horizontal
  scroll inside the pane only).
- Interactions: expand/collapse; leaf click renders content + sets `location.hash` to the
  `file` path; hash on load expands/selects/scrolls (deep links); search = case-insensitive
  substring on leaf names, matches auto-expand, clearing restores prior collapse state; Enter
  with exactly one match selects it. Below ~700px the tree becomes a hamburger overlay.
  Missing `db-structure.data.js` → full-page "run `pnpm db-introspect`" hint.

### Phase 5 — verification (read-only; no env rebuilds — house rule)
- Run `pnpm db-introspect` against dev. Spot-check one of each object kind: a table's `\d+`
  shows columns/indexes/FKs/**policies**/triggers (e.g. `app/tables/tenant.txt`), a function's
  `.sql` reads as complete `CREATE OR REPLACE` source, an enum's `\dT+` lists values, an
  overloaded function pair got deterministic `__2` naming.
- Re-run immediately; `git status` (read-only inspection is fine — no git *actions*) shows only
  the `manifest.txt` timestamp + its mirrored `generatedAt` in the rollup changing.
- Open `docs/db-structure/index.html` via `file://`: tree renders, search filters, a hash link
  restores selection. `pnpm build` still green.
- Expected scale sanity check vs the spec's 2026-07-23 inventory: ~41 schemas, ~55 tables,
  ~272 functions, ~35 enums, ~43 composite types, 2 triggers.

### Phase 6 — wrap-up
- Fold any contract corrections discovered in flight back into the spec files; flip their
  Status lines to Implemented.
- Remind the user the output is theirs to commit (`docs/db-structure/` is designed to be
  committed — never commit it for them).
- Ask the user before moving this plan to `addressed/` (memory
  `feedback_ask_before_moving_addressed`).

## Sequencing summary

Strictly linear: Phase 1 → 2 → 3 → 4 → 5 → 6. No user gates mid-run (no rebuilds, no sqitch,
no codegen) — the only user touchpoints are the final commit of `docs/db-structure/` and
sign-off at Phase 6.

## Post-implementation addendum (2026-07-24 — executed; spec is the source of truth)

All six phases done same day. Live capture matched the spec's expected inventory exactly
(41 schemas, 55 tables, 272 functions, 35 enums, 43 types, 2 triggers). Rerun diff = manifest
timestamp + its two rollup mirrors only. Rollup is 624 KB. `pnpm build` green (13/13 cached).
Deviations/finds: foreign tables (inventoried, no output mapping in the spec) are captured
under `<schema>/tables/` — folded into `db-structure.data.md`; `-q` added to the capture psql
call (suppresses `\pset` chatter on stdout — no effect on `\o` file content). No overloaded
functions exist in the live DB yet, so `__2` naming is exercised by logic only. Browser page
verified headlessly (jsdom over real `file://` URLs — script-tag data load, tree render, leaf
click, breadcrumb, hash set + deep-link restore, search filter/restore, single-match Enter,
missing-data hint: 19/19 checks) because the sandboxed MCP browser was crashing on every URL,
including example.com. Spec Status lines flipped to Implemented; output left uncommitted for
the user.

**Amendment (2026-07-24, user request post-completion):** the per-object tree is no longer
written into the repo — capture goes to a `mkdtemp` scratch tree and only `index.html` +
`db-structure.data.js` land in `docs/db-structure/` (the rollup is the sole committed
artifact / diff surface). Spec README locked decisions + `db-structure.data.md` updated to
match; jsdom verification re-run green (19/19).

## Out of scope / linked

- **`scripts/ops/` placement + shared ops psql-runner helper** — rejected in the spec README;
  the `users-snapshot` deferred question stays deferred over there, untriggered here.
- **`n8n_engine` DB** — excluded by locked decision (n8n-internal state).
- Any Nuxt page / GraphQL surface for this content — explicitly rejected in the spec.
