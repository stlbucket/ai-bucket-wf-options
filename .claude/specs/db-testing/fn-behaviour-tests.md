# db-testing — behaviour tests (on `<module>_fn` functions)

## Status
Draft — fill in all [FILL IN] sections before implementing.

**What this covers:** the user's "functionality tests on `_fn` functions" — call the privileged
internals directly and assert what they *do*: side effects, derived columns, cascades, recursion,
and the exceptions they raise on bad input. Prereqs: `_shared.md` (seed helpers — `_fn` behaviour
tests generally need a real **tenant + resident**, since the functions touch `app.resident`,
`res.resource`, and `res_fn.register_resource`).

File: `db/<pkg>/test/030-fn-behaviour.sql`.

Run these as `authenticated` with a valid tenant+resident in claims (the `_fn`s read `jwt.*`
indirectly via the caller and via `app.resident`), or — since `_fn` has no permission gate — as the
owner with the claims GUC set. Every file is `BEGIN … ROLLBACK`, so all seeded rows and resource
registrations vanish.

---

## Ground truth for the pilot (`db/fnb-todo/deploy/00000000010470_todo_fn.sql`)

The `todo_fn` functions have rich, testable behaviour beyond a bare insert:

| Function | Behaviour worth asserting |
|---|---|
| `todo_fn.create_todo(citext, create_todo_options, uuid)` | inserts; computes `ordinal` (0 for root, `count+1` under a parent); sets `root_todo_id = id` for a root; generates `urn` via `res_fn.build_urn`; calls `res_fn.register_resource`; when a parent is given, flips **parent** `type → 'milestone'` and cascades status |
| `todo_fn.update_todo_status(uuid, todo.todo_status)` | raises `'30029'` for a template todo; on `complete`, when **all** siblings are complete, recurses parent → `complete`; on `incomplete`, recurses parent → `incomplete` |
| `todo_fn.delete_todo(uuid)` | recursively deletes children first; `res_fn.archive_resource`; when the deleted row was the parent's **last** child, flips parent `type → 'task'` |
| `todo_fn.deep_copy_todo(uuid, uuid, boolean, uuid)` | raises `'30030'` when the source id is missing; deep-copies the subtree (recursion over children); carries `is_template` |
| `todo_fn.create_todo` name guard | raises `'30028'` when `name` is null or `< 3` chars (also enforced by the table `CHECK`) |

## Canonical shape

```sql
BEGIN;
SELECT plan( 7 );

-- seed a tenant + resident, become that user
SELECT test._seed_tenant('tenant-a');            -- :tenant_a
SELECT test._seed_resident(:'tenant_a');          -- :resident_a
SELECT test._login( :'profile_a', :'tenant_a', ARRAY['p:todo'], :'resident_a' );

-- ── create_todo: root gets ordinal 0, root_todo_id = id, a urn, and a resource row ──
SELECT lives_ok(
  $$ SELECT todo_fn.create_todo('root task',
       ROW(NULL,NULL,'{}'::citext[],false)::todo_fn.create_todo_options, ':resident_a'::uuid) $$,
  'create_todo(root) succeeds' );
-- capture the row for follow-on assertions (use a temp or re-select by name)
SELECT is(
  (SELECT ordinal FROM todo.todo WHERE name = 'root task'), 0,
  'root todo has ordinal 0' );
SELECT is(
  (SELECT (root_todo_id = id) FROM todo.todo WHERE name = 'root task'), true,
  'root todo is its own root' );
SELECT isnt(
  (SELECT urn FROM todo.todo WHERE name = 'root task'), NULL,
  'create_todo generated a urn (res_fn.build_urn)' );
SELECT is(
  (SELECT count(*)::int FROM res.resource r
     JOIN todo.todo t ON t.id = r.id WHERE t.name = 'root task'), 1,
  'create_todo registered a res.resource row' );

-- ── name guard ──────────────────────────────────────────────────────────────
SELECT throws_ok(
  $$ SELECT todo_fn.create_todo('ab',
       ROW(NULL,NULL,'{}'::citext[],false)::todo_fn.create_todo_options, ':resident_a'::uuid) $$,
  'P0001', NULL,
  'create_todo rejects a < 3 char name (30028)' );

-- ── status cascade: completing the only child completes the parent ───────────
--   build parent + child via create_todo, then update_todo_status(child,'complete')
--   and assert parent.status = 'complete'. [FILL IN parent/child ids from the returned rows]
SELECT is(
  ( /* parent status after completing its only child */ NULL ),   -- [FILL IN]
  'complete'::text,
  'completing the last incomplete child completes the parent' );

SELECT * FROM finish();
ROLLBACK;
```

Notes / gotchas specific to `todo_fn`:
- **Capturing the created row.** `create_todo` returns `todo.todo`; in script style either wrap the
  call in a CTE that `RETURNING`s into a temp table, or re-`SELECT … WHERE name = …` (names are
  unique enough within a rolled-back test). Keep `plan(N)` in sync.
- **Recursion.** `update_todo_status`, `delete_todo`, and `deep_copy_todo` all recurse. Build at
  least a 2-level tree (parent + child, or parent + two children) so the cascade branches actually
  execute — a single-node test proves nothing about the recursion.
- **`res.resource` coupling.** `create_todo` → `res_fn.register_resource`; `delete_todo` →
  `res_fn.archive_resource`. Assert these registry side effects, not just the `todo.todo` row —
  they're the part most likely to silently break. (`fnb-res` owns that schema — confirm
  `res.resource` columns with `fnb-db-designer`.)
- **Template guard.** `update_todo_status` raises `'30029'` for `is_template = true`; cover it.
- **Exceptions are `P0001`** with the `'300NN: …'` message — assert via `throws_ok(sql,'P0001',NULL,…)`
  or a message match.

## Checklist to apply per package
1. Happy-path side effects of each `_fn` write (derived columns, registry rows, timestamps).
2. Every explicit `raise exception '3xxxx …'` guard has a `throws_ok`.
3. Every recursive/cascading branch is exercised with a multi-row fixture.
4. Registry coupling (`res_fn.register_resource`/`archive_resource`) asserted where present.
