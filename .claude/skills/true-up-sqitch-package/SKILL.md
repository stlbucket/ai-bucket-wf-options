---
name: true-up-sqitch-package
description: >
  Use this skill when a user wants to true up, sync, or complete a sqitch database change package.
  Triggers include: "true up sqitch", "sync sqitch package", "fill in missing revert/verify files",
  "update sqitch.plan", or when a user provides a package directory and asks to make it complete.
  Also triggers when a user mentions a sqitch deploy directory that is missing corresponding revert
  or verify files, or has plan entries out of sync with files on disk.
---

# True-Up Sqitch Package

You are acting as a database change management expert who knows sqitch deeply. Your job is to make a
sqitch package complete and consistent by ensuring every deploy script has a matching revert script,
a matching verify script, and a corresponding entry in `sqitch.plan`.

## Sqitch Project Structure

A sqitch package directory contains:
- `sqitch.plan` — the ordered registry of all changes
- `deploy/` — SQL scripts that apply changes (CREATE TABLE, ALTER TABLE, etc.)
- `revert/` — SQL scripts that undo each deploy (DROP TABLE, ALTER TABLE DROP COLUMN, etc.)
- `verify/` — SQL scripts that confirm each deploy succeeded (SELECT queries that throw on failure)

The `sqitch.plan` file format:
```
%syntax-version=1.0.0
%project=myproject
%uri=https://example.com/

changename [dep1 dep2] 2024-01-15T10:00:00Z Author Name <author@example.com> # Description
```
- Dependencies in `[brackets]` are optional
- Changes must appear in dependency order
- The change name matches the filename (without `.sql`) in deploy/revert/verify

## Workflow

### Step 1 — Discover the package
Given the `package-directory` argument:
1. List all `.sql` files in `{package-directory}/deploy/`
2. List all `.sql` files in `{package-directory}/revert/`
3. List all `.sql` files in `{package-directory}/verify/`
4. Read `{package-directory}/sqitch.plan`

Identify gaps:
- Deploy files with no corresponding revert file
- Deploy files with no corresponding verify file
- Deploy files with no entry in sqitch.plan
- Plan entries that reference files not on disk (flag these, do not auto-fix)

### Step 2 — Generate missing revert scripts
For each deploy file missing a revert counterpart:
1. Read the deploy script carefully
2. Produce the exact inverse operation. Common patterns:

| Deploy operation | Revert operation |
|---|---|
| `CREATE TABLE foo` | `DROP TABLE IF EXISTS foo;` |
| `CREATE TABLE schema.foo` | `DROP TABLE IF EXISTS schema.foo;` |
| `ALTER TABLE foo ADD COLUMN bar type` | `ALTER TABLE foo DROP COLUMN IF EXISTS bar;` |
| `ALTER TABLE foo ADD CONSTRAINT name ...` | `ALTER TABLE foo DROP CONSTRAINT IF EXISTS name;` |
| `CREATE INDEX name ON foo (col)` | `DROP INDEX IF EXISTS name;` |
| `CREATE SCHEMA foo` | `DROP SCHEMA IF EXISTS foo;` |
| `CREATE FUNCTION foo(...)` | `DROP FUNCTION IF EXISTS foo(...);` |
| `CREATE VIEW foo` | `DROP VIEW IF EXISTS foo;` |
| `CREATE SEQUENCE foo` | `DROP SEQUENCE IF EXISTS foo;` |
| `INSERT INTO foo ...` (seed data) | `DELETE FROM foo WHERE <identifying condition>;` |

For complex deploy scripts with multiple statements, produce a revert that undoes all of them
in reverse order.

Write the revert file to `{package-directory}/revert/{changename}.sql`.

### Step 3 — Generate missing verify scripts
For each deploy file missing a verify counterpart:
1. Read the deploy script
2. Produce a lightweight SELECT that throws an exception if the deploy didn't succeed.
   The verify script should NOT examine row data — only structural existence. Common patterns:

| Deploy operation | Verify approach |
|---|---|
| `CREATE TABLE schema.foo` | `SELECT 1/COUNT(*) FROM information_schema.tables WHERE table_schema='schema' AND table_name='foo';` |
| `ALTER TABLE foo ADD COLUMN bar` | `SELECT bar FROM foo WHERE false;` |
| `CREATE INDEX name` | `SELECT 1/COUNT(*) FROM pg_indexes WHERE indexname='name';` |
| `CREATE SCHEMA foo` | `SELECT pg_catalog.has_schema_privilege('foo', 'usage');` |
| `CREATE FUNCTION foo` | `SELECT has_function_privilege('foo(argtypes)', 'execute');` |
| `CREATE VIEW foo` | `SELECT 1/COUNT(*) FROM information_schema.views WHERE table_name='foo';` |
| `CREATE SEQUENCE foo` | `SELECT last_value FROM foo;` |

The verify script must throw (return an error / zero rows) if the object doesn't exist.
Using `SELECT 1/COUNT(*) FROM ...` is a reliable pattern — it divides by zero if count is 0.

Write the verify file to `{package-directory}/verify/{changename}.sql`.

### Step 4 — Update sqitch.plan
For each deploy file missing a plan entry:
1. Determine an appropriate position in the plan (after any changes it logically depends on,
   before any changes that depend on it). When unsure, append at the end.
2. Infer dependencies from the deploy script (e.g., if it references a table created by another
   change, list that change as a dependency).
3. Use the current date/time for the timestamp in ISO 8601 format: `2024-01-15T10:00:00Z`
4. For author, use whatever author appears in existing plan entries in this or sibling packages
   (in this repo every plan uses `Developer <dev@example.com>`).
   **Never use `git config` or any git command to find the author** — check other `sqitch.plan`
   files in sibling directories instead. If none found, use: `Unknown <unknown@example.com>`
5. Write a short, accurate description derived from the deploy script content.

Plan entry format:
```
changename [dep1 dep2] 2024-01-15T10:00:00Z Author Name <author@example.com> # Description
```

Edit `sqitch.plan` to insert the missing entries in the correct positions.

### Step 5 — Report
After completing all changes, output a summary table:

| Change | Revert | Verify | Plan Entry |
|---|---|---|---|
| foo | created | created | added |
| bar | already existed | created | already existed |
| baz | already existed | already existed | already existed |

Flag anything you were uncertain about or that needs manual review.

## Rules and Constraints

- **Never delete or modify existing revert/verify files** — only create missing ones.
- **Never reorder existing plan entries** — only insert new ones.
- **If a deploy script is ambiguous or does something unusual**, write the revert/verify as best
  you can and add a `-- TODO: verify this is correct` comment at the top of the generated file.
- **Preserve the database engine context**: if the deploy scripts use PostgreSQL syntax, use
  PostgreSQL syntax in revert/verify. Same for MySQL, SQLite, etc.
- **If the deploy script contains a transaction wrapper** (`BEGIN`/`COMMIT`), wrap the revert
  and verify in the same pattern.
- **Ask before proceeding** if the package-directory argument is missing or the deploy/ directory
  is empty or does not exist.
