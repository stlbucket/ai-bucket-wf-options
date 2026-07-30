# pgTAP Assertion Catalog

Every function returns `TEXT` (a TAP line) unless noted "returns SETOF". Call with `SELECT …`;
inside PL/pgSQL use `RETURN NEXT …`. The trailing `description` is optional everywhere but you
should always pass it. Signatures reflect pgTAP 1.3.x (https://pgtap.org/documentation.html).

Legend: `schema` and `table`/object args are `name`/`text`; `arg_types` is `name[]` (e.g.
`ARRAY['integer','text']`); `privs` is `text[]`. Most `has_*` accept a schema-qualified form
**and** a short form that searches `search_path`.

---

## 1. Plan & finish  (call the SETOF ones with `SELECT * FROM …`)

| Call | Meaning |
|---|---|
| `plan( integer )` | Declare exact number of assertions. |
| `no_plan()` → SETOF | Don't pre-declare a count (discouraged; hides "test didn't run"). |
| `finish()` → SETOF | Emit summary of planned-vs-run; report extras/missing. |
| `finish( exception_on_failure boolean )` → SETOF | As above but **RAISE** on any failure. |
| `done_testing()` → SETOF | Alias/alternative to `finish()` (Perl-style). |

---

## 2. Core TAP assertions

### Verdicts
- `ok( boolean, description )` — passes if TRUE; **fails on FALSE or NULL** (NULL prints a diag).
- `pass( description )` / `fail( description )` — unconditional.

### Equality (NULL-safe)
- `is( have anyelement, want anyelement, description )` — `IS NOT DISTINCT FROM`; two NULLs pass.
- `isnt( have, want, description )` — `IS DISTINCT FROM`.
- Works for records: `is( t.*, ROW(1,'x',true)::t )`.

### Operator comparison
- `cmp_ok( have anyelement, operator text, want anyelement, description )` — e.g.
  `cmp_ok(a,'@>',b)`. Fails if the operator yields NULL. Best diagnostics of the comparison
  family ("got X / expected {op} Y").

### Type
- `isa_ok( have anyelement, regtype, name text )` — asserts the value's type; on failure prints
  the actual type. `name` labels the thing being checked.

### Pattern matching
| Regex | LIKE |
|---|---|
| `matches( have, regex, description )` (`~`) | `alike( have, pattern, description )` (`LIKE`) |
| `imatches( have, regex, description )` (`~*`) | `ialike( have, pattern, description )` (`ILIKE`) |
| `doesnt_match( have, regex, description )` (`!~`) | `unalike( have, pattern, description )` (`NOT LIKE`) |
| `doesnt_imatch( have, regex, description )` (`!~*`) | `unialike( have, pattern, description )` (`NOT ILIKE`) |

---

## 3. Schema / object existence  ("schema things")

Pattern for almost every object kind: `has_<kind>(...)`, `hasnt_<kind>(...)`, and a plural
`<kind>s_are(scope, name[], description)` that asserts the scope contains **exactly** that set
(reports missing **and** extra). Short forms omit the schema and search `search_path`.

### Tables / views / columns
- `has_table( schema, table, desc )` · `has_table( table, desc )` · `hasnt_table( … )`
- `tables_are( schema, name[], desc )` · `tables_are( name[], desc )`
- `has_view( schema, view, desc )` · `hasnt_view` · `views_are( schema, name[], desc )`
- `has_materialized_view( schema, mview, desc )` · `hasnt_materialized_view` ·
  `materialized_views_are( [schema,] name[], desc )`
- `has_foreign_table( schema, ftable, desc )` · `hasnt_foreign_table` · `foreign_tables_are(…)`
- `has_column( schema, table, column, desc )` · `has_column( table, column, desc )` ·
  `hasnt_column( … )`
- `columns_are( schema, table, name[], desc )` — table has exactly these columns.
- `col_type_is( schema, table, column, regtype, desc )` — with optional typmod in the type text.
- `col_not_null( schema, table, column, desc )` / `col_is_null( … )`
- `col_has_default( … )` / `col_hasnt_default( … )`
- `col_default_is( schema, table, column, expected, desc )` — `expected` may be any type or text.

### Keys / constraints
- `has_pk( schema, table, desc )` / `hasnt_pk( … )`
- `col_is_pk( schema, table, column|column[], desc )` / `col_isnt_pk( … )`
- `has_fk( schema, table, desc )` / `hasnt_fk( … )`
- `col_is_fk( schema, table, column|column[], desc )` / `col_isnt_fk( … )`
- `fk_ok( fk_schema, fk_table, fk_column, pk_schema, pk_table, pk_column, desc )` — verifies an
  actual FK relationship; column args may be arrays for composite keys.
- `col_is_unique( schema, table, column|column[], desc )`
- `has_unique( schema, table, column[], desc )` — the columns form a unique constraint.
- `has_check( schema, table, desc )` · `col_has_check( schema, table, column|column[], desc )`

### Indexes
- `has_index( schema, table, index, [columns,] desc )` / `hasnt_index( … )`
- `indexes_are( schema, table, name[], desc )`
- `index_is_unique( schema, table, index, desc )` · `index_is_primary( … )` ·
  `index_is_partial( … )` · `index_is_type( schema, table, index, am_type, desc )` (e.g. `'btree'`,
  `'gin'`)
- `is_indexed( schema, table, column|column[], desc )` — column(s) are covered by some index.
- `is_clustered( schema, table, [index,] desc )`

### Triggers
- `has_trigger( schema, table, trigger, desc )` / `hasnt_trigger( … )`
- `triggers_are( schema, table, name[], desc )`
- `trigger_is( schema, table, trigger, function_schema, function, desc )` — trigger calls fn.
  (Older/other form asserts event/timing/level — check your installed version.)

### Functions / procedures
- `has_function( schema, function, [arg_types,] desc )` / `hasnt_function( … )`
- `functions_are( schema, name[], desc )`
- `can( schema, name[], desc )` — the schema has functions with these names (callable).
- `function_returns( schema, function, [arg_types,] return_type, desc )`
- `function_lang_is( schema, function, [arg_types,] language, desc )`
- `is_definer( … )` / `isnt_definer( … )` — SECURITY DEFINER?
- `is_strict( … )` / `isnt_strict( … )`
- `is_normal_function` / `isnt_normal_function`, `is_aggregate` / `isnt_aggregate`,
  `is_window` / `isnt_window`, `is_procedure` / `isnt_procedure` — all take
  `( schema, function, [arg_types,] desc )`.
- `volatility_is( schema, function, [arg_types,] volatility, desc )` — `'IMMUTABLE'|'STABLE'|'VOLATILE'`.

### Sequences / types / domains / enums / composites
- `has_sequence( schema, seq, desc )` / `hasnt_sequence` / `sequences_are( schema, name[], desc )`
- `has_type( schema, type, desc )` / `hasnt_type` / `types_are( schema, name[], desc )`
- `has_domain( schema, domain, desc )` / `hasnt_domain` / `domains_are( schema, name[], desc )`
- `domain_type_is( schema, domain, base_type, desc )` / `domain_type_isnt( … )`
- `has_enum( schema, enum, desc )` / `hasnt_enum` / `enums_are( schema, name[], desc )`
- `enum_has_labels( schema, enum, label[], desc )` — exactly these labels, in order.
- `has_composite( schema, type, desc )` / `hasnt_composite` (+ composite `columns_are`).

### Schemas / languages / extensions / tablespaces
- `has_schema( schema, desc )` / `hasnt_schema` / `schemas_are( name[], desc )` (excludes system).
- `has_language( lang, desc )` / `hasnt_language` / `languages_are( name[], desc )` ·
  `language_is_trusted( lang, desc )`
- `has_extension( [schema,] extension, desc )` / `hasnt_extension` / `extensions_are( [schema,] name[], desc )`
- `has_tablespace( name, [location,] desc )` / `hasnt_tablespace` / `tablespaces_are( name[], desc )`

### Casts / operators / opclasses
- `has_cast( source_type, target_type, desc )` / `hasnt_cast` ·
  `cast_context_is( source, target, 'IMPLICIT'|'ASSIGNMENT'|'EXPLICIT', desc )` ·
  `casts_are( text[], desc )` where each element is `'source AS target'`.
- `has_operator( schema, 'op(left,right)', [return_type,] desc )` / `hasnt_operator` ·
  `has_leftop` / `has_rightop` (unary) + `hasnt_*` ·
  `operators_are( schema, text[], desc )` where each is `'=(int,int) RETURNS boolean'`.
- `has_opclass( schema, name, desc )` / `hasnt_opclass` / `opclasses_are( schema, name[], desc )`

### Rules / inheritance / partitioning
- `has_rule( schema, relation, rule, desc )` / `hasnt_rule` / `rules_are( schema, relation, name[], desc )`
- `rule_is_instead( schema, relation, rule, desc )` ·
  `rule_is_on( schema, relation, rule, 'SELECT'|'INSERT'|'UPDATE'|'DELETE', desc )`
- `has_inherited_tables( schema, table, desc )` / `hasnt_inherited_tables`
- `is_ancestor_of( aschema, atable, dschema, dtable, [generations,] desc )` / `isnt_ancestor_of`
- `is_descendent_of( dschema, dtable, aschema, atable, [generations,] desc )` / `isnt_descendent_of`
- `is_partitioned( schema, table, desc )` / `isnt_partitioned` ·
  `is_partition_of( pschema, partition, parent_schema, parent, desc )` ·
  `partitions_are( schema, table, name[], desc )`

### Roles / users / groups
- `has_role( role, desc )` / `hasnt_role` / `roles_are( name[], desc )`
- `has_user( user, desc )` / `hasnt_user` / `users_are( name[], desc )`
- `has_group( group, desc )` / `hasnt_group` / `groups_are( name[], desc )`
- `is_member_of( role|group, member, desc )` / `isnt_member_of( … )` — `member` may be `name[]`.
- `is_superuser( role, desc )` / `isnt_superuser( … )`

---

## 4. Ownership

All take `( …object identity…, owner_role, desc )`:
- `db_owner_is( db, owner, desc )` · `schema_owner_is( schema, owner, desc )` ·
  `tablespace_owner_is( name, owner, desc )`
- `relation_owner_is( schema, relation, owner, desc )` (tables **and** views) ·
  `table_owner_is( schema, table, owner, desc )` · `view_owner_is( … )` ·
  `materialized_view_owner_is( … )` · `sequence_owner_is( … )` · `foreign_table_owner_is( … )` ·
  `composite_owner_is( … )` · `index_owner_is( schema, index, owner, desc )`
- `function_owner_is( schema, function, arg_types, owner, desc )`
- `language_owner_is( lang, owner, desc )` · `opclass_owner_is( schema, opclass, owner, desc )` ·
  `type_owner_is( schema, type, owner, desc )`

---

## 5. Privileges & RLS

Each `*_privs_are` asserts the role holds **exactly** the listed privileges on the object.
- `database_privs_are( db, role, privs, desc )` — e.g. `ARRAY['CONNECT','CREATE','TEMPORARY']`
- `schema_privs_are( schema, role, privs, desc )` — `ARRAY['USAGE','CREATE']`
- `table_privs_are( schema, table, role, privs, desc )` —
  `ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']`
- `any_column_privs_are( schema, table, role, privs, desc )` — role has priv on **some** column.
- `column_privs_are( schema, table, column, role, privs, desc )` — on a **specific** column.
- `sequence_privs_are( schema, seq, role, privs, desc )` — `ARRAY['USAGE','SELECT','UPDATE']`
- `function_privs_are( schema, function, arg_types, role, privs, desc )` — usually `ARRAY['EXECUTE']`
- `language_privs_are( lang, role, privs, desc )` · `tablespace_privs_are( name, role, privs, desc )`
- `fdw_privs_are( fdw, role, privs, desc )` · `server_privs_are( server, role, privs, desc )`

### RLS policies
- `policies_are( schema, table, name[], desc )` — table has exactly these policies.
- `policy_roles_are( schema, table, policy, role[], desc )` — policy applies to exactly these roles.
- `policy_cmd_is( schema, table, policy, 'SELECT'|'INSERT'|'UPDATE'|'DELETE'|'ALL', desc )`

> To test that RLS **behaves**, set the session context (`SET ROLE …`, `SET app.claims …`) and
> then use the result-set assertions (`is_empty`, `set_eq`, `throws_ok`) — the policy metadata
> assertions above only check the *definition*. See `fnb-patterns.md`.

---

## 6. Result-set comparisons

Every query argument may be: a SQL string, a prepared-statement name, `'EXECUTE stmt(args)'`, a
`VALUES` statement, a `refcursor`, or (single-column only) an `ARRAY[…]`. Column count/types
must match between the two sides.

| Function | Order matters? | Dupes matter? | Use for |
|---|---|---|---|
| `results_eq( q1, q2, desc )` / `results_ne` | **yes** | yes | ordered output; add `ORDER BY` |
| `set_eq( q1, q2, desc )` / `set_ne` | no | **no** | "the same set of rows" |
| `set_has( super, sub, desc )` / `set_hasnt` | no | no | subset / disjoint |
| `bag_eq( q1, q2, desc )` / `bag_ne` | no | **yes** | multiset with counts |
| `bag_has( super, sub, desc )` / `bag_hasnt` | no | yes | sub-multiset / disjoint |

- `is_empty( query, desc )` — zero rows. `isnt_empty( query, desc )` — ≥ 1 row.
- `row_eq( query, record, desc )` — the (single) row equals a composite: `ROW(1,'a')::my_type`.

Single-column array form (very common for id lists):
```sql
SELECT set_eq( 'SELECT id FROM active_users()', ARRAY[2,3,4,5] );
```

---

## 7. Exceptions

- `throws_ok( sql, [errcode], [errmsg], [desc] )` — passes if `sql` raises. Overloads:
  - `throws_ok( sql, sqlstate, errmsg, desc )` — pin both (most precise).
  - `throws_ok( sql, sqlstate )` / `throws_ok( sql, errmsg )` — a **5-char** 2nd arg = SQLSTATE,
    longer = message. Prefer SQLSTATE (messages are localized/reworded).
  - `throws_ok( sql )` — passes on *any* exception.
- `throws_like( sql, like_pattern, desc )` · `throws_ilike( … )` — message matches LIKE/ILIKE.
- `throws_matching( sql, regex, desc )` · `throws_imatching( … )` — message matches regex.
- `lives_ok( sql, desc )` — passes if `sql` does **not** raise.
- `dies_ok( sql, desc )` — alias for `throws_ok(sql)` (any exception).

`sql` may be a query string or a prepared-statement name, same as result-set functions.

---

## 8. Performance

- `performs_ok( sql, max_millis, desc )` — one execution must finish under `max_millis`.
- `performs_within( sql, avg_millis, within_millis, [iterations,] desc )` — runs `iterations`
  times (default 10), discards the top/bottom 10%, averages the middle 80%, asserts the mean is
  `avg_millis ± within_millis`.

> Timing tests are environment-sensitive — keep budgets generous in CI or gate them behind a tag.

---

## 9. Diagnostics, skip, todo

- `diag( text )` — emit a `# comment` line (not a test). Handy for context on failure.
- `skip( why, how_many )` — mark the next `how_many` assertions skipped (they still count toward
  the plan). Typical use: `SELECT CASE WHEN cond THEN collect_tap(…) ELSE skip(why, n) END;`
- `todo( why, how_many )` — the next `how_many` are **expected to fail**; a pass is a "TODO
  passed" (bonus), a fail is not counted against you.
- `todo_start( [why] )` … `todo_end()` — block form. `in_todo()` → boolean, are we inside one.
- `collect_tap( VARIADIC text[] )` / `collect_tap( text[] )` — combine several TAP lines into one
  result (used with `skip`/`CASE`).

---

## 10. Utilities

- `pgtap_version()` → numeric/text · `pg_version()` → text · `pg_version_num()` → int (e.g.
  `160000`) · `os_name()` → text. Use these to gate version-specific tests via `skip`.
- `findfuncs( schema, like_pattern[, exclude_like] )` → `text[]` — names of matching functions
  (drives `runtests`-style discovery).
- `runtests( [schema], [match_pattern] )` → SETOF TEXT — the xUnit runner (see `running-tests.md`).
- `do_tap( [schema], [pattern] )` → SETOF TEXT — run matching test functions **without** the
  startup/setup/teardown/shutdown lifecycle (plain batch).
- `display_oper( name, regoperator )`, `format_type_string( regtype )` — internal formatting
  helpers occasionally useful in custom assertions.

### Rolling your own assertion
Any function returning `TEXT` that calls `ok(...)` internally is a valid pgTAP assertion. The
building blocks: `ok( bool, desc )` for the verdict and `diag( … )` for detail. Keep the plan
count in mind — a custom assertion should emit exactly one `ok`.
