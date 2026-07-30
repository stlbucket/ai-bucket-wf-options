# db-structure.data.md — capture contract

## Status
Implemented 2026-07-24 (`scripts/db-introspect.ts`). One clarification found in flight:
**foreign tables** are inventoried as their own kind but have no output mapping of their own —
they are captured under `<schema>/tables/` (same `\d+` command, and `\d+` output is identical
in shape); the manifest/rollup `tables` count includes them.

**Amended 2026-07-24 (user decision):** the per-object tree is captured into a **temp
directory** (`mkdtemp`, removed after the run), not into the repo. `docs/db-structure/` holds
only the hand-written `index.html` and the generated `db-structure.data.js` — the rollup is
the sole committed artifact and the sole diff surface. Everything below about the tree shape,
per-object commands, and file paths still holds verbatim; the tree just lives in the temp
capture root, and item `file` paths persist only inside the rollup as stable tree ids /
hash-link targets.

## CLI surface

```
pnpm db-introspect
```

No flags. Runs the full capture + rollup every time (the whole run is a few seconds).
Prints per-kind object counts on success and the output root path.

Script: `scripts/db-introspect.ts` (tsx, flat in `scripts/` like the other db-*
scripts). Imports `PG_URL` and `REPO_ROOT` from `./_env`. All psql executions use the
house docker pattern:

```
docker run --rm -i --network fnb-network \
  -v "${REPO_ROOT}/docs/db-structure:/out" -w /out \
  postgres:18 psql ${PG_URL} --no-psqlrc -v ON_ERROR_STOP=1 …
```

The volume mount + `-w /out` make relative `\o` paths land in `docs/db-structure/`.

## Pipeline (four steps, two psql calls)

### Step 1 — inventory (psql call #1)

One `psql -tA` call returning a single JSON document (built with `json_build_object` /
`json_agg`) enumerating every capturable object. Common filters for **all** kinds:

- schema `NOT LIKE 'pg\_%'` and `<> 'information_schema'`
- **extension members excluded**: no row in `pg_depend` with `deptype = 'e'` for the
  object's oid/classid (this removes `pgcrypto`/`uuid-ossp`/`citext` members from `public`)

| Kind | Source | Captured fields |
|---|---|---|
| schemas | `pg_namespace` | name |
| tables | `pg_class` `relkind IN ('r','p')` | schema, name |
| views | `relkind = 'v'` | schema, name |
| matviews | `relkind = 'm'` | schema, name |
| foreign tables | `relkind = 'f'` | schema, name |
| sequences | `relkind = 'S'` | schema, name |
| functions | `pg_proc` `prokind IN ('f','p')` | schema, name, oid, `pg_get_function_identity_arguments(oid)` |
| enums | `pg_type` joined `pg_enum` | schema, name |
| composite types | `pg_type` `typtype='c'` whose `typrelid` has `relkind='c'` (standalone `CREATE TYPE`, not table row types) | schema, name |
| domains | `pg_type` `typtype='d'` | schema, name |
| triggers | `pg_trigger` `NOT tgisinternal` | schema, table, name, oid |

Today's inventory (2026-07-23, for scale): 41 schemas, 55 tables, 272 functions,
35 enums, 43 composite types, 2 triggers, 79 policies (captured inside `\d+`), 0
views/matviews/sequences/domains. The contract handles every kind whether or not any
exist yet; **empty category directories are not created**.

### Step 2 — wipe + mkdir (Node)

Delete every entry directly under `docs/db-structure/` **except `index.html`**, then
pre-create every directory the inventory requires (`\o` cannot mkdir).

### Step 3 — capture (psql call #2)

Generate one psql script (in the session scratchpad, not the repo) from the inventory and
run it in a single session. Sections:

**Overview** (`_overview/`):

```
\o _overview/schemas.txt        \dn+
\o _overview/extensions.txt     \dx+
\o _overview/roles.txt          \du+
\o _overview/default-privileges.txt   \ddp
```

**Per schema** — files under `<schema>/`, iterating the inventory in sorted order:

| Output file | Command |
|---|---|
| `<schema>/grants.txt` | `\dp <schema>.*` |
| `<schema>/tables/<table>.txt` | `\d+ <schema>.<table>` (columns, indexes, checks, FKs, referenced-by, **policies**, triggers) |
| `<schema>/views/<view>.txt` | `\d+ <schema>.<view>` (includes the view definition) |
| `<schema>/matviews/<mv>.txt` | `\d+ <schema>.<mv>` |
| `<schema>/sequences/<seq>.txt` | `\d+ <schema>.<seq>` |
| `<schema>/enums/<enum>.txt` | `\dT+ <schema>.<enum>` |
| `<schema>/types/<type>.txt` | `\d <schema>.<type>` |
| `<schema>/domains/<domain>.txt` | `\dD+ <schema>.<domain>` |
| `<schema>/functions/<name>.sql` | `SELECT pg_get_functiondef(<oid>);` (see formatting below) |
| `<schema>/triggers/<table>__<trigger>.sql` | `SELECT pg_get_triggerdef(<oid>, true);` |

Function/trigger sections are bracketed with `\t on` + `\pset format unaligned`
(restored to `\t off` + `aligned` afterwards) so the `.sql` files contain bare source,
no column headers or row-count footers.

**Overload naming**: functions sharing a name in a schema are sorted by their identity
arguments; the first keeps `<name>.sql`, subsequent ones get `<name>__2.sql`,
`<name>__3.sql`. The identity-argument string is stable, so numbering is deterministic
across runs. Each function file gets a leading comment line
`-- <schema>.<name>(<identity args>)` so overload files self-identify.

**Manifest** — written by Node after the capture:

```
_overview/manifest.txt
  generated-at: <ISO timestamp>       ← the ONLY timestamp anywhere in the output
  database: <PG_URL host/dbname, credentials stripped>
  schemas: 41   tables: 55   functions: 272   enums: 35   …
```

### Step 4 — rollup (Node)

Walk the finished tree and emit `docs/db-structure/db-structure.data.js`:

```js
window.DB_STRUCTURE = {
  generatedAt: '<ISO timestamp>',            // mirrors manifest.txt
  overview: [                                 // _overview/* in fixed order
    { name: 'manifest.txt', content: '…' },
    { name: 'schemas.txt', content: '…' },
    …
  ],
  schemas: [                                  // sorted by name
    {
      name: 'app',
      grants: '…',                            // grants.txt content
      categories: [                           // only non-empty ones, fixed order:
        {                                     // tables, views, matviews, sequences,
          kind: 'tables',                     // enums, types, domains, functions, triggers
          items: [ { name: 'tenant', file: 'app/tables/tenant.txt', content: '…' }, … ]
        },
        …
      ]
    },
    …
  ],
}
```

- `content` is the exact file text (JSON-escaped). `file` is the repo-relative path under
  `docs/db-structure/` (shown as the breadcrumb / used for hash links).
- Everything sorted (schemas, items) — deterministic output, clean diffs.
- Expected size ~1–3 MB. Plain `JSON.stringify` embedded in the one assignment; no
  chunking, no compression.

## Output tree (reference)

```
docs/db-structure/
├── index.html                 ← hand-written browser (browser.ui.md); NEVER regenerated
├── db-structure.data.js       ← generated rollup (step 4)
├── _overview/
│   ├── manifest.txt  schemas.txt  extensions.txt  roles.txt  default-privileges.txt
├── app/
│   ├── grants.txt
│   ├── tables/tenant.txt …
│   ├── enums/… types/… functions/… triggers/…
├── app_api/ … app_fn/ … (every non-system schema, module trios included)
└── sqitch/ …
```

## Failure modes

- Any psql error aborts the run (`ON_ERROR_STOP=1`) with a non-zero exit; the tree may be
  partially written — rerunning always starts from the wipe, so there is no corrupt state
  to repair.
- Missing `PG_URL` fails fast in `_env.ts`.
- `pg_get_functiondef` errors on non-plain functions are prevented upstream by the
  `prokind IN ('f','p')` inventory filter (no aggregates/window functions captured).
