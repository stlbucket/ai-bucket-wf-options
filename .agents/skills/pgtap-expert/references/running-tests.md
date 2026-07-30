# Installing, writing, and running pgTAP tests

## Install the extension

pgTAP ships as a PostgreSQL extension. On the **server** (it can't be installed remotely):

```bash
make && make install && make installcheck     # from a source checkout; use gmake if needed
# if pg_config isn't on PATH:
env PG_CONFIG=/path/to/pg_config make && make install
```

Then, as a superuser, in the target database:

```sql
CREATE EXTENSION IF NOT EXISTS pgtap;          -- PG 9.1+
CREATE EXTENSION pgtap SCHEMA tap;             -- or pin it to a schema
```

Pre-9.1 (rare): `psql -d mydb -f /…/share/contrib/pgtap.sql`.

Because it installs ~1000 functions, many projects load pgTAP into a **throwaway/CI database**
or a dedicated schema, run tests, and never ship it to production.

---

## Style A — script files + `pg_prove` (the common path)

One transaction per file, declare a plan, assert, finish, roll back:

```sql
-- test/010-users.sql
BEGIN;
SELECT plan( 6 );

SELECT has_table( 'app', 'users' );
SELECT has_pk(    'app', 'users' );
SELECT has_column('app', 'users', 'email' );
SELECT col_not_null('app', 'users', 'email' );
SELECT col_type_is( 'app', 'users', 'email', 'citext' );
SELECT throws_ok(
  $$ INSERT INTO app.users (email) VALUES (NULL) $$,
  '23502',                    -- not_null_violation
  NULL,
  'email cannot be null'
);

SELECT * FROM finish();
ROLLBACK;
```

Run the whole suite with the bundled TAP harness:

```bash
pg_prove -d mydb test/*.sql                    # basic
pg_prove -U postgres -h localhost -d mydb -r test/    # recurse a dir
pg_prove --verbose -d mydb test/*.sql          # show each assertion
pg_prove --pset tuples_only=1 -d mydb t/*.sql  # if you didn't use \pset in-file
```

Useful `pg_prove` flags (it wraps Perl's `prove`, plus `psql` connection opts):
`-d/--dbname`, `-U/--username`, `-h/--host`, `-p/--port`, `-r/--recurse`, `-v/--verbose`,
`-f/--failures` (only show failures), `-j N` (run N files in parallel — **safe** because each
file is its own txn), `--runtests` (use the `runtests()` runner instead of parsing files),
`-s/--schema` (schema holding pgTAP when `--runtests`).

No `pg_prove`? Any TAP consumer works — e.g. `psql -Xqtf test/010-users.sql | prove -`.

### Standalone `installcheck` harness (no external harness)

For a file you run directly with `psql`, silence psql chrome so only TAP prints:

```sql
\unset ECHO
\set QUIET 1
\pset format unaligned
\pset tuples_only true
\pset pager off
\set ON_ERROR_ROLLBACK 1
\set ON_ERROR_STOP true

BEGIN;
SELECT plan( 3 );
SELECT has_schema( 'app' );
SELECT has_table( 'app', 'users' );
SELECT ok( true, 'sanity' );
SELECT * FROM finish();
ROLLBACK;
```

`psql -Xf test/010-users.sql mydb` then emits clean TAP.

---

## Style B — xUnit functions + `runtests()`

Write tests as **functions returning `SETOF TEXT`**; pgTAP discovers and runs them, each in its
**own transaction that is rolled back afterward** (perfect isolation between tests).

Lifecycle functions, matched by name prefix:

| Prefix | Runs | Transaction |
|---|---|---|
| `startup*` | once, before everything | its own txn |
| `setup*` | before **each** `test*` | inside that test's txn |
| `test*` | the actual tests | one txn each, rolled back |
| `teardown*` | after **each** `test*` | inside that test's txn |
| `shutdown*` | once, after everything | its own txn |

```sql
CREATE OR REPLACE FUNCTION test_users_shape() RETURNS SETOF TEXT AS $$
BEGIN
  RETURN NEXT has_table( 'app', 'users' );
  RETURN NEXT has_column( 'app', 'users', 'email' );
  RETURN NEXT col_type_is( 'app', 'users', 'email', 'citext' );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION setup_seed() RETURNS SETOF TEXT AS $$
BEGIN
  INSERT INTO app.users (email) VALUES ('a@x.io'), ('b@x.io');
  RETURN;                    -- setup may emit no assertions
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION test_seed_count() RETURNS SETOF TEXT AS $$
BEGIN
  RETURN NEXT is( (SELECT count(*) FROM app.users)::int, 2, 'two seeded users' );
END;
$$ LANGUAGE plpgsql;
```

Run them (note: **no `plan()`/`finish()`** — `runtests` manages the plan):

```sql
SELECT * FROM runtests();                 -- all test* functions found
SELECT * FROM runtests( 'app' );          -- only in schema app
SELECT * FROM runtests( 'app'::name, '^test_users' );  -- name filter (regex)
SELECT * FROM runtests( '^test_seed' );   -- filter across search_path
```

`do_tap([schema],[pattern])` is the same batch discovery **without** the startup/setup/teardown/
shutdown lifecycle — just runs the matching `test*` functions.

Because the functions persist in the DB, xUnit style suits a test schema you deploy (e.g. a
sqitch `test` change) and re-run; script style suits ad-hoc `.sql` files checked into `test/`.

---

## Reading the output

```
1..6
ok 1 - app.users should exist
ok 2 - app.users should have a primary key
not ok 3 - app.users should have column email
# Failed test 3: "app.users should have column email"
ok 4 - …
# Looks like you failed 1 test of 6
```

- `1..N` is the plan. A trailing `# Looks like you planned N but ran M` means a **plan mismatch**.
- Lines beginning `#` are diagnostics (`diag`, failure detail) — not counted.
- `finish(true)` converts any failure into a raised exception (exit non-zero under psql), useful
  as a CI gate without a TAP harness.

---

## CI notes
- Run against a **disposable** database (create → `CREATE EXTENSION pgtap` → deploy schema →
  `pg_prove` → drop). Keeps pgTAP out of prod and tests hermetic.
- `pg_prove -j` parallelizes across files safely (txn-per-file). Don't parallelize assertions
  within a file.
- Timing assertions (`performs_ok`/`performs_within`) are flaky in shared CI — tag or skip them
  (`SELECT CASE WHEN os_name() = 'linux' THEN performs_ok(...) ELSE skip('no perf in CI',1) END;`).
