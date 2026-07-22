---
name: pgtap-expert
description: Expert in pgTAP — the PostgreSQL unit-testing framework (https://pgtap.org) that runs tests as SQL functions emitting TAP. Use this skill for any pgTAP task: writing a test file, choosing the right assertion, testing schema shape (tables/columns/constraints/indexes/triggers/functions), testing RLS policies and grants, comparing result sets (results_eq/set_eq/bag_eq), asserting exceptions (throws_ok/lives_ok), performance budgets (performs_ok/performs_within), the xUnit runtests() runner with startup/setup/test/teardown/shutdown, running via pg_prove, or the BEGIN/plan()/finish()/ROLLBACK harness. Triggers include: "pgTAP", "pg_prove", "test my schema/RLS/function in Postgres", "results_eq/set_eq/throws_ok", "runtests()", or writing database unit tests. Prefer this skill over memory — exact signatures, NULL/ordering semantics, and the set-vs-bag-vs-results distinction are easy to get wrong.
---

# pgTAP Expert

pgTAP is a unit-testing framework **written in PL/pgSQL and SQL**. Every test is a function
call that returns one line of [TAP](https://testanything.org) (`ok 1 - description` /
`not ok 2 - description`). You run the SQL, collect the TAP, and a TAP harness (`pg_prove`,
`prove`, or the built-in `runtests()`) reports pass/fail. Because tests are just SQL, they run
**inside the database** with full access to the catalogs, RLS context, roles, and your own
functions — which is exactly why it beats black-box testing for a Postgres/RLS stack.

**Homepage/docs:** https://pgtap.org/documentation.html · **Current version:** 1.3.x

> This skill is a **generic pgTAP technology reference**. pgTAP is **not currently wired into
> the fnb repo** — the sqitch packages verify with plain-SQL `verify/*.sql` scripts (the
> `select 1/count(*) from …` divide-by-zero trick). If you're adding pgTAP to fnb, read
> `references/fnb-patterns.md` for how it maps onto the `<module>`/`_fn`/`_api`/RLS design and
> the sqitch layout; for sqitch mechanics defer to skill `sqitch-expert`.

---

## The mental model (read this first)

1. A test **file** wraps everything in a transaction and declares a plan:
   ```sql
   BEGIN;
   SELECT plan( 5 );          -- I will run exactly 5 assertions

   SELECT has_table( 'users' );
   SELECT ok( 2 + 2 = 4, 'arithmetic still works' );
   -- …three more…

   SELECT * FROM finish();    -- emit the plan-vs-actual summary
   ROLLBACK;                  -- leave the DB untouched
   ```
2. Each assertion function **returns TEXT** (the TAP line). Call it with `SELECT`. In a
   PL/pgSQL body use `RETURN NEXT some_assert(...)`.
3. The **plan** is a contract: `plan(N)` means "exactly N assertions will fire." Miscounting is
   itself a failure — that's the point (it catches tests that silently didn't run). Use
   `no_plan()` only when you truly can't count them.
4. `finish()` prints the summary line and, with `finish(true)`, **raises an exception** on any
   failure (handy inside a larger transaction or CI gate).
5. Every assertion takes an optional trailing **`description`** — always supply one; it's what
   shows up in the TAP output and in failure diagnostics.

Two ways to run a suite — pick one, don't mix in one file:

| Style | You write | You run | Isolation |
|---|---|---|---|
| **Script** (most common) | `.sql` files with `BEGIN; plan(); …; finish(); ROLLBACK;` | `pg_prove db/test/*.sql` | one txn per file |
| **xUnit** (`runtests()`) | test **functions** `test_*()` returning `SETOF TEXT`, plus optional `startup/setup/teardown/shutdown` | `SELECT runtests();` | one txn per `test_*` fn, auto-rolled-back |

Details + examples for both: `references/running-tests.md`.

---

## Decision guide — which assertion?

Jump to the exact signature in `references/assertions.md`; this is the router.

- **A boolean I computed** → `ok(bool, desc)`. Prefer a specific matcher when one exists —
  better diagnostics.
- **Two scalars/records equal** → `is(have, want, desc)` (NULL-safe: `IS NOT DISTINCT FROM`,
  so `is(NULL,NULL)` **passes**). Not-equal → `isnt`. Never use `ok(a = b)` for this — `a = b`
  is NULL when either side is NULL and you lose the "got X, expected Y" diagnostic.
- **Compare with an operator** (`>`, `<@`, `~`, `&&`, …) → `cmp_ok(have, 'op', want, desc)`.
- **Text vs pattern** → regex `matches`/`imatches`/`doesnt_match`; LIKE `alike`/`ialike`/`unalike`.
- **Type of a value** → `isa_ok(val, 'regtype', name)`.
- **Does a DB object exist / have shape?** (tables, columns, PK/FK/unique/check, indexes,
  triggers, sequences, functions, types, enums, domains, schemas, roles, extensions…) →
  the **"schema things"** family — `has_*` / `hasnt_*`, the exhaustive `*_are` list-matchers,
  `col_*`, `fk_ok`, `trigger_is`, `function_returns`, `enum_has_labels`, … See
  `references/assertions.md` §Schema.
- **Ownership / privileges / RLS** → `*_owner_is`, `*_privs_are`, `policies_are`,
  `policy_roles_are`, `policy_cmd_is`. This is the money family for an RLS stack —
  `references/assertions.md` §Privileges and `references/fnb-patterns.md`.
- **A query returns the right rows** → choose by what matters:
  - order **and** dupes matter → `results_eq` / `results_ne`
  - it's a **set** (order & dupes irrelevant) → `set_eq` / `set_ne` / `set_has` / `set_hasnt`
  - it's a **bag** (dupes count, order doesn't) → `bag_eq` / `bag_ne` / `bag_has` / `bag_hasnt`
  - exactly zero / at least one row → `is_empty` / `isnt_empty`
  - one specific row → `row_eq(query, ROW(...)::type)`
- **Something must raise / must not raise** → `throws_ok` (by SQLSTATE and/or message),
  `throws_like`/`throws_ilike`/`throws_matching`/`throws_imatching`, `lives_ok`, `dies_ok`.
- **Performance budget** → `performs_ok(sql, ms, desc)` (single run under a ceiling),
  `performs_within(sql, avg_ms, ±ms, iterations, desc)` (statistical).
- **Conditionally skip / expected-fail** → `skip(why, howmany)`, `todo(why, howmany)` /
  `todo_start(why)…todo_end()`.

**The single most common mistake:** reaching for `results_eq` when the query's order is
undefined (no `ORDER BY`). Two runs of an unordered query can differ in row order and the test
flakes. Use `set_eq`/`bag_eq` unless you have an explicit `ORDER BY` and you're *testing the
ordering*.

---

## Core cheat sheet

```sql
-- Plan / finish
SELECT plan( 12 );                 SELECT * FROM no_plan();
SELECT * FROM finish();            SELECT * FROM finish( true );   -- raise on failure

-- Verdicts & equality
SELECT pass( 'desc' );             SELECT fail( 'desc' );
SELECT ok( expr, 'desc' );
SELECT is( have, want, 'desc' );   SELECT isnt( have, want, 'desc' );   -- NULL-safe
SELECT cmp_ok( have, '>=', want, 'desc' );
SELECT matches( have, '^re$', 'desc' );   SELECT alike( have, 'lk%', 'desc' );

-- Schema shape
SELECT has_table( 'public', 'users', 'desc' );
SELECT has_column( 'public', 'users', 'email', 'desc' );
SELECT col_type_is( 'public', 'users', 'id', 'integer', 'desc' );
SELECT col_not_null( 'public', 'users', 'id' );
SELECT has_pk( 'public', 'users' );
SELECT fk_ok( 'public','orders','user_id', 'public','users','id' );
SELECT columns_are( 'public', 'users', ARRAY['id','name','email'] );

-- Grants & RLS
SELECT table_privs_are( 'public','users','app', ARRAY['SELECT','INSERT'] );
SELECT function_privs_are( 'app_fn','do_it',ARRAY['citext'],'app_user',ARRAY['EXECUTE'] );
SELECT policies_are( 'public','users', ARRAY['tenant_isolation'] );
SELECT policy_cmd_is( 'public','users','tenant_isolation', 'ALL' );

-- Result sets
SELECT set_eq( 'SELECT id FROM active()', ARRAY[1,2,3] );
SELECT results_eq( 'SELECT * FROM f() ORDER BY 1', 'SELECT * FROM g() ORDER BY 1' );
SELECT is_empty( 'SELECT * FROM users WHERE id < 0' );
SELECT row_eq( 'SELECT 1, ''a''', ROW(1,'a')::my_type );

-- Exceptions
SELECT throws_ok( 'SELECT 1/0', '22012', 'division by zero', 'desc' );
SELECT lives_ok( 'INSERT INTO t VALUES (1)', 'desc' );
```

Full catalog with every signature and the argument-count variants:
**`references/assertions.md`**.

---

## Fine print that bites (from the docs)

- **`plan(N)` is exact.** Emit more or fewer assertions than `N` and the run is reported as
  failing even if every assertion passed. Recount when you add/remove tests, or use `no_plan()`.
- **`is`/`isnt` are NULL-safe** (`IS [NOT] DISTINCT FROM`); `ok`, `cmp_ok`, and `matches`
  **fail on a NULL result** and print a diagnostic. Choose accordingly when NULL is a legal value.
- **Identifiers are case-sensitive strings.** Pass lowercase (`'users'`) — Postgres folds
  unquoted identifiers to lowercase. Only use mixed case for objects created with `"Quotes"`.
- **Function tests need the argument-type array** to disambiguate overloads:
  `has_function('app_fn','f', ARRAY['citext','uuid'])`. Types must match the catalog exactly
  (`ARRAY['integer']` not `ARRAY['int4']`? — pgTAP normalizes via `regtype`, but be consistent;
  when in doubt copy the `pg_get_function_identity_arguments` form).
- **`results_eq` compares row-by-row in order** — an unordered query flakes; add `ORDER BY` or
  switch to `set_eq`/`bag_eq`.
- **Column count and types must line up** in `results_eq`/`set_eq`/`bag_eq`. Mismatched column
  lists throw a hard error, not a soft failure.
- **`row_eq`** wants a real composite: `ROW(...)::some_type`. On PG < 11 a bare `RECORD` won't
  cast — name the type. Field types must be comparable.
- **Query arguments** to result/exception functions may be: a SQL string, a **prepared-statement
  name** (no spaces → treated as a statement, not SQL), `"quoted name"`, `'EXECUTE stmt(args)'`,
  a `VALUES (…)` statement, a `refcursor`, or (single-column only) an `ARRAY[…]`.
- **`throws_ok` argument overloads:** a 5-character second arg is read as a **SQLSTATE**, anything
  longer as an **error message**. Provide both (`throws_ok(sql, sqlstate, msg, desc)`) when you
  want to pin the exact error; SQLSTATE alone is the most robust (messages get localized/reworded).
- **`finish()` returns a set** — call it `SELECT * FROM finish();`. Same for `no_plan()` and
  `runtests()`.
- **Everything rolls back.** Tests run inside `BEGIN…ROLLBACK` (script style) or an auto-rolled
  transaction (`runtests`), so `INSERT`/`DELETE`/`SET ROLE` inside a test don't persist — which
  is what lets you set an RLS context, probe it, and leave no trace.

---

## Reference files

- **`references/assertions.md`** — the complete function catalog: plan/finish, core TAP,
  schema/object existence + `*_are` matchers, ownership, privileges & RLS policies, result-set
  comparisons, exception & performance tests, diagnostics/skip/todo, utilities. Exact signatures.
- **`references/running-tests.md`** — writing a test file, the `pg_prove` CLI and its flags, the
  `runtests()` xUnit runner (startup/setup/test/teardown/shutdown naming), collecting TAP in CI,
  and the standalone `installcheck`/`\i` harness.
- **`references/fnb-patterns.md`** — applying pgTAP to *this* repo's stack: testing RLS with
  `SET ROLE` + claims GUCs, the `_fn`/`_api` two-layer grants, where a `db/<pkg>/test/` tree
  would live, and how pgTAP relates to (does not replace) the existing sqitch `verify` scripts.
