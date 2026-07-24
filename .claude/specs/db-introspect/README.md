# db-introspect — psql-native DB structure docs + static tree browser

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor
> .claude/specs/db-introspect/README.md` — the implementor derives the
> `.claude/issues/` plan file (R23) from the task list below, then executes it.

## Status
Implemented 2026-07-24 — `scripts/db-introspect.ts` + `pnpm db-introspect` + hand-written
`docs/db-structure/index.html`. Plan:
`.claude/issues/…/0010__db________db-introspect-structure-docs____MED__.plan.md`. One contract
clarification (foreign tables browse under `tables/`) noted in `db-structure.data.md`.

## Purpose

A single command that captures the **entire live structure of the fnb database** as
psql-native text files — one file per object, in a temp capture tree — rolled up into
`docs/db-structure/db-structure.data.js`, plus a zero-dependency static HTML page that lets a
human browse the whole thing in a big tree view (schemas → tables / functions / enums /
types / triggers → object detail).

The capture is the non-interactive equivalent of sitting in psql and running `\dn+`,
`\d+ <schema>.<table>` for every table, the function source for every function
(`pg_get_functiondef` — the batch equivalent of `\ef`), `\dT+` for every enum, and so on
for every object kind present. The output is committed, so schema drift shows up in PR
diffs, and the browser page works from any checkout with no server.

This is a regular member of the **root `db-*` script family** (`db-start`, `db-psql`,
`db-exec`, …): `pnpm db-introspect` → `scripts/db-introspect.ts`, flat in `scripts/`.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Tool shape | Root `db-*` family member: `scripts/db-introspect.ts`, invoked `pnpm db-introspect` | User chose the flat db-* script convention over the `ops:` family 2026-07-23 — it is a repeatable dev doc tool (like `graphql-api-generate`), not a one-off ops utility. |
| Transport | `docker run --rm -i --network fnb-network postgres:18 psql ${PG_URL}` with the repo `docs/db-structure/` volume-mounted for `\o` output (the `scripts/db-exec.ts` pattern); `PG_URL` from `.env` via `scripts/_env.ts` | Proven family pattern; no new Node deps, no host-published port. |
| Function capture | `SELECT pg_get_functiondef(oid)` per function, saved as `.sql` | `\ef` is interactive (opens an editor) and `\sf` needs exact overload signatures; `pg_get_functiondef(oid)` is the robust batch equivalent and returns the full `CREATE OR REPLACE` source. |
| Table capture | `\d+ <schema>.<table>` per table | One command already includes columns, indexes, check/FK constraints, referenced-by, **RLS policies with USING/WITH CHECK expressions**, and trigger associations — exactly the psql view the user asked for. |
| Extension members excluded | Objects owned by extensions (`pg_depend` `deptype='e'`) are skipped from per-object dumps | `pgcrypto`/`uuid-ossp`/`citext` contribute ~93 functions in `public` that are pure noise; `\dx+` in the overview documents extensions instead. (272 real functions remain today.) |
| Schema scope | The fnb DB (`PG_URL`) only; **all** non-system schemas (module trios + `auth`, `jwt`, `public`, `sqitch`, `postgraphile_watch`) | Complete is better for a browser; `sqitch` is cheap and occasionally useful. The `n8n_engine` DB is n8n-internal state — excluded. |
| Output committed to git | Only `index.html` + `db-structure.data.js` (user commits; never Claude) — the per-object tree is a **temp-only build intermediate** (user decision 2026-07-24, superseding the original whole-tree commit) | Schema drift is visible in the rollup's diff; the browser works from any checkout without 400+ loose files in the repo. Per-object content carries no timestamps so diffs stay meaningful. |
| Regeneration semantics | Each run captures into a temp tree, deletes everything under `docs/db-structure/` **except `index.html`**, then writes a fresh `db-structure.data.js` | Dropped objects disappear; stable ordering + no per-object timestamps keep reruns idempotent (rollup diff = `generatedAt` only). `index.html` is hand-written and never regenerated. |
| Browser data loading | One generated rollup `db-structure.data.js` (`window.DB_STRUCTURE = {…}`) loaded by `<script src>` from the hand-written `index.html` | `fetch()` of many files is blocked by CORS over `file://`; a script-tag rollup works with a double-click, no server. User suggested "or maybe a rollup" — locked. |
| Browser tech | Single static HTML file, vanilla JS, zero dependencies | This is dev tooling outside the Nuxt apps — no auth, no build, no deploy. Nuxt UI / UC rules do not apply (noted in `browser.ui.md`), but the green/slate brand palette is kept. |
| Timestamp placement | Only in `_overview/manifest.txt` (generated-at + object counts) | Keeps every other file's diff purely structural. |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | This index — decisions, task list |
| `db-structure.data.md` | Full capture contract: inventory query, output tree, per-object psql commands, rollup format, regeneration semantics |
| `browser.ui.md` | The static tree-browser page: layout, tree/search behavior, deep-linking, styling |

R18 mapping: the browser page's `.ui.md` is `browser.ui.md`; its data contract (the rollup
shape it consumes) lives in `db-structure.data.md`. There is no Nuxt page and no GraphQL —
this is a host-side script + static file.

## Implementation Task List

### Phase 1 — scaffolding
- [x] `scripts/db-introspect.ts` (tsx; imports `PG_URL`/`REPO_ROOT` from `./_env`)
- [x] Root `package.json` script: `"db-introspect": "tsx scripts/db-introspect.ts"`

### Phase 2 — inventory + capture
- [x] Inventory pass: one docker-psql call returning the JSON object inventory
      (schemas, relations, functions with identity args, enums, composite types, domains,
      triggers, sequences — extension members excluded) per `db-structure.data.md`
- [x] Wipe `docs/db-structure/` (preserving `index.html`), pre-create the directory tree
- [x] Generate the capture psql script (`\o` redirects + meta-commands + functiondef
      selects) and run it in one docker-psql call with `ON_ERROR_STOP=1`
- [x] Write `_overview/manifest.txt` (generated-at, per-kind counts)

### Phase 3 — rollup
- [x] Walk the output tree and emit `docs/db-structure/db-structure.data.js`
      (`window.DB_STRUCTURE`, shape per `db-structure.data.md`)

### Phase 4 — browser page
- [x] Hand-written `docs/db-structure/index.html` per `browser.ui.md`: tree pane,
      content pane, search filter, hash deep-links, light/dark

### Phase 5 — verification (no env rebuilds — house rule)
- [x] Run `pnpm db-introspect` against dev; spot-check one of each object kind
      (a table's `\d+` shows policies/triggers, a function's `.sql` compiles by eye,
      an enum's `\dT+` lists values)
- [x] Re-run immediately; `git status` shows only `manifest.txt`-embedded timestamp churn
- [x] Open `docs/db-structure/index.html` via `file://`; tree renders, search filters,
      hash link restores selection

## Remaining Open Questions
- None blocking. (This tool is in the `db-*` family, not `scripts/ops/` — the
  `users-snapshot` deferred question about a shared ops psql-runner helper stays
  deferred over there, untriggered by this spec.)

## Considered & rejected

- **`scripts/ops/` family placement** (`pnpm ops:db-structure`) — the first draft of this
  spec. User chose the flat `db-*` convention 2026-07-23: this is a repeatable dev tool
  run against any env, not a one-off operational utility.
- **Literal `\ef` / `\sf` per function** — `\ef` opens `$EDITOR` (interactive-only);
  `\sf` requires exact overload signatures. `pg_get_functiondef(oid)` from the inventory
  is the faithful batch equivalent.
- **`pg_dump --schema-only`** — one giant DDL file: no per-object browsing, none of the
  `\d+` niceties (referenced-by, policy summaries) the user asked for.
- **Third-party doc generators (SchemaSpy, postgresql-autodoc, etc.)** — heavy deps
  (Java/Graphviz), different output dialect; the ask was explicitly psql-native output.
- **`fetch()`-based browser loading many raw files** — blocked by CORS on `file://`;
  would force a local server for a docs page. Rollup script tag wins.
- **A Nuxt page (tenant-app tools)** — this is developer docs about the DB, not an app
  feature; a page would drag in auth, deploy, and a GraphQL surface for content that is
  static text on disk.
- **One docker run per object** — 400+ container spawns; the single generated capture
  script runs everything in one psql session.
- **Gitignoring the output** — hides schema drift from PR diffs and makes the browser
  useless on a fresh checkout until regenerated.
