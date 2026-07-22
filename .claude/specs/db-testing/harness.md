# db-testing — harness (pgTAP install + `scripts/db-test.ts` runner)

## Status
Draft — fill in all [FILL IN] sections before implementing.

This is the open decision the `0260__test-foundation` plan left to the user
(`.claude/issues/identified/0260__testing___test-foundation…plan.md`, "Decide the harness with the
user"). Locked here: tests run against the **running dev DB** via a new `scripts/db-test.ts` that
mirrors the existing `scripts/db-*.ts` family.

---

## 1. Provisioning pgTAP — dev-only, in two halves (IMPLEMENTED)

The dev DB ran on the stock **`postgis/postgis`** image, which ships PostGIS but **not** pgTAP
(a separate `postgresql-<major>-pgtap` OS package + a `CREATE EXTENSION`). Design landed:

**Half 1 — OS package baked into a dev-only image (`docker/db.Dockerfile`).**
```dockerfile
FROM postgis/postgis
RUN apt-get update \
 && apt-get install -y --no-install-recommends "postgresql-${PG_MAJOR}-pgtap" \
 && rm -rf /var/lib/apt/lists/*
```
`PG_MAJOR` is set by the base postgres image, so the package always matches the running major (no
tag pinning). `docker-compose.yml`'s `db` service now `build`s this (`image: fnb-db-pgtap:local`).

**Half 2 — the EXTENSION is created on demand by the runner**, not at bootstrap: `db/_test/setup.sql`
runs `CREATE EXTENSION IF NOT EXISTS pgtap SCHEMA tap` (superuser `postgres`) at the start of every
`pnpm db-test`. So pgTAP's ~1000 functions exist **only while/after you run DB tests**, never
otherwise, and `infra/docker/pg-bootstrap.sh` is **untouched** — production uses managed Postgres
(`infra/compose/docker-compose.prod.yml`) and never builds this image, so **pgTAP never reaches
prod**. (This is why D6 evolved from "add to pg-bootstrap.sh" to "dev image + on-demand" — the
bootstrap path would have leaked pgTAP into prod.)

> ⚠️ **Repo rule / hand-off:** *never rebuild the env yourself.* The implementor wrote the Dockerfile
> + compose change; the **user** runs `docker compose build db && docker compose up -d db` once, then
> `pnpm db-test fnb-todo`. The runner fails fast with these exact instructions if the pgtap OS
> package is missing (extension create errors).

> Managed-Postgres note: DO/AWS clusters only allow a fixed extension allow-list; pgTAP availability
> there is **out of scope** — this suite targets local/dev (+ a future CI throwaway DB), never prod.

---

## 2. `scripts/db-test.ts` — the runner

Mirror `scripts/db-exec.ts` (`docker run --rm -i --network fnb-network … postgres:18 psql
${PG_URL} …`) and `scripts/_env.ts` (`PG_URL` from `.env`). Shape:

```
pnpm db-test              # run db/*/test/*.sql across every package
pnpm db-test fnb-todo     # run one package's suite
pnpm db-test fnb-todo 010 # run one file / prefix
```

Steps the script performs:

1. Resolve target files: `db/<pkg>/test/*.sql` (all packages, or the arg-named one), sorted.
2. **Create the `test` helper schema** (`test._login/_logout/_seed_*` from `_shared.md`) on the DB.
   Do this as a single owner-connection preamble file the runner `\i`s first — **outside** the
   per-test transactions so the helpers persist for the run — then **drop `test` schema** at the end.
3. Ensure the `tap` schema/extension exists (fail fast with a clear message pointing at §1 if not).
4. Run the tests. Two execution modes; the runner picks by what's available:

   - **pg_prove path (preferred):** if a `pg_prove`-capable image/binary is available, run
     `pg_prove --schema tap -d "$PG_URL" <files>`. Best output, `-j` parallelism (safe — txn per
     file). Requires an image with Perl + `TAP::Parser` + `pg_prove` (the `postgres:18` client
     image does **not** have it → [FILL IN] which image, e.g. a tiny `Dockerfile` adding
     `libtap-parser-sourcehandler-pgtap-perl`, or run `pg_prove` host-side if installed).
   - **psql-only fallback (no extra image):** loop each file through the existing
     `docker run … postgres:18 psql ${PG_URL} -v ON_ERROR_STOP=1 -f <file>`, with each file ending
     `SELECT * FROM finish(true);`. `finish(true)` **raises on any failed assertion** → psql exits
     non-zero → the runner aggregates exit codes and fails the run. Sets
     `search_path = tap, public, "$user"` via `PGOPTIONS` or a per-file `SET search_path`.

5. Exit non-zero if any file failed. Output is **verbose**: psql runs in `-qtA` (bare-TAP) mode and
   the runner parses it, printing every assertion by name (`✓ <desc>` / `✗ <desc>`) grouped under
   each file with an `(passed/planned)` count, then a final `files, assertions passed` summary. On
   failure it also prints the plan-mismatch note + `#` diagnostics / stderr for that file.

> **Locked:** ship the **psql-only fallback first** (works with the existing `postgres:18` image,
> zero new infra beyond the extension), and treat the pg_prove path as an enhancement. The test
> files are identical either way — only the runner differs.

---

## 3. `package.json` wiring

- Add root script: `"db-test": "tsx scripts/db-test.ts"` (next to `db-exec`, `db-psql`).
- **Do not** fold this into `pnpm test` / turbo — that pipeline is per-package **vitest** and must
  stay runnable without Docker/Postgres. DB tests are a **separate gate**: `pnpm db-test`.
- Optional: a `db-test` turbo task with `"dependsOn": []` and no cache, or leave it out of turbo
  entirely (recommended — it's an integration gate, not a per-package unit task).

## 4. CI notes

- Run against a **disposable** DB (create → deploy sqitch packages → `CREATE EXTENSION pgtap`
  in `tap` → `db-test` → drop). Keeps pgTAP out of prod and tests hermetic.
- `pg_prove -j` parallelizes across files safely (one txn per file). Never parallelize assertions
  within a file.
- Skip timing assertions (`performs_ok`) in shared CI — flaky. The pilot uses none.

## Open questions
- [ ] pg_prove image vs host binary vs psql-only-forever — decide after the pilot proves the files.
- [ ] Is `db-rebuild` extended to re-`CREATE EXTENSION pgtap`, or is that a one-time bootstrap?
- [ ] Does CI get its own disposable-DB job, or is `db-test` dev-only for now?
