# db-testing — permission tests (on `<module>_api` functions)

## Status
Draft — fill in all [FILL IN] sections before implementing.

**What this covers:** the user's "permissions checks on api functions" — assert the permission
**gate** each `<module>_api` function enforces (does it raise for a caller lacking the required
`p:` key?) and the **grant shape** (who may `EXECUTE` what). Prereqs: `_shared.md`.

File: `db/<pkg>/test/020-api-permissions.sql`.

---

## Ground truth for the pilot (`db/fnb-todo`) — and the gap this suite exposes

`todo_api` functions (`db/fnb-todo/deploy/00000000010470_todo_fn.sql`) delegate to `todo_fn`. Only
**one** of them actually gates on a permission:

```sql
-- todo_api.create_todo(_name citext, _options todo_fn.create_todo_options)
if jwt.has_permission('p:todo') = false then
  raise exception '30000: PERMISSION DENIED';   -- surfaces as SQLSTATE P0001
end if;
```

`update_todo`, `update_todo_status`, `delete_todo`, `pin_todo`, `unpin_todo`, `assign_todo`,
`search_todos`, `make_template_from_todo`, `make_todo_from_template` do **no** `jwt.has_permission`
check — they call straight through to `todo_fn`. **The suite documents this as-is:** it asserts the
one real gate positively/negatively, and for the ungated functions it records the current reality
with a note so a future tightening has a failing test to flip.

> This is precisely the class of gap the `0260__test-foundation` plan wanted surfaced — permission
> enforcement that exists on paper but is applied inconsistently. Write the tests against **actual
> behaviour**, and flag the divergence in a "Known Gaps" block in the test file header, not by
> asserting behaviour that doesn't exist.

## Permission-gate assertions

```sql
BEGIN;
SELECT plan( 3 );

SELECT test._seed_tenant('tenant-a');           -- :tenant_a
SELECT test._seed_resident(:'tenant_a');         -- :resident_a

-- caller WITHOUT p:todo → create_todo is rejected
SELECT test._login( :'profile_a', :'tenant_a', ARRAY[]::text[], :'resident_a' );
SELECT throws_ok(
  $$ SELECT todo_api.create_todo('buy milk', ROW(NULL,NULL,'{}'::citext[],false)::todo_fn.create_todo_options) $$,
  'P0001', NULL,
  'create_todo without p:todo raises PERMISSION DENIED' );

-- caller WITH p:todo → create_todo succeeds (lives_ok)
SELECT test._login( :'profile_a', :'tenant_a', ARRAY['p:todo'], :'resident_a' );
SELECT lives_ok(
  $$ SELECT todo_api.create_todo('buy milk', ROW(NULL,NULL,'{}'::citext[],false)::todo_fn.create_todo_options) $$,
  'create_todo with p:todo succeeds' );

-- DOCUMENTED GAP: update_todo has no gate — caller without p:todo can still call it.
-- Asserted as current reality; flip to throws_ok when the api layer is tightened.
SELECT test._login( :'profile_a', :'tenant_a', ARRAY[]::text[], :'resident_a' );
SELECT lives_ok(
  $$ SELECT todo_api.update_todo(gen_random_uuid(), 'renamed') $$,   -- [FILL IN] real id via seed
  'GAP: update_todo is currently ungated (no p:todo required)' );

SELECT * FROM finish();
ROLLBACK;
```

Notes:
- The stack's `raise exception '30000: …'` surfaces as SQLSTATE **`P0001`** with that message —
  assert `throws_ok(sql, 'P0001', NULL, label)`, or match the message text
  (`throws_ok(sql, NULL, '%PERMISSION DENIED%', label)`).
- `create_todo` also has real side effects (`res_fn.register_resource`, `app.resident` lookup) →
  it needs a seeded resident, hence `test._seed_resident`. If seeding the full graph is heavy,
  assert the gate with a caller that fails the permission check **before** any side effect runs
  (the `has_permission` check is the first statement) — the negative test needs no valid resident.

## Grant-shape assertions — and the second divergence

The pgtap-expert skill's canonical example asserts "`authenticated` may EXECUTE the `_api` fn; the
`_fn` fn is internal (no grant); `_fn` is `SECURITY DEFINER`." **None of that holds for `fnb-todo`:**

- `db/fnb-todo/deploy/00000000010480_todo_policies.sql` grants **`all on all routines`** in
  **`todo_api`, `todo_fn`, and `todo`** to `anon, authenticated, service_role`. So `todo_fn`
  functions are directly EXECUTE-able by `authenticated` **and** `anon`.
- Every `todo_fn`/`todo_api` function is `SECURITY INVOKER`, **not** `SECURITY DEFINER`.

So the `_fn`/`_api` split in this stack is **organizational, not a privilege boundary** — isolation
comes from RLS (the tenant policy) plus the api-layer `has_permission` checks, not from grant
scoping or definer rights. Assert the **actual** grants so the fact is pinned and a future
tightening is a deliberate, test-visible change:

```sql
-- reality today (pins the current, broad grant):
SELECT function_privs_are(
  'todo_api', 'create_todo',
  ARRAY['citext','todo_fn.create_todo_options'],
  'authenticated', ARRAY['EXECUTE'],
  'authenticated may EXECUTE todo_api.create_todo' );

SELECT function_privs_are(
  'todo_fn', 'create_todo',
  ARRAY['citext','todo_fn.create_todo_options','uuid'],
  'anon', ARRAY['EXECUTE'],
  'GAP: anon can EXECUTE todo_fn.create_todo directly (broad grant — organizational split only)' );

SELECT isnt_definer(
  'todo_api', 'create_todo',
  ARRAY['citext','todo_fn.create_todo_options'],
  'todo_api.create_todo is SECURITY INVOKER (not definer)' );
```

> **Decision for the README:** do the grant-shape tests **pin current reality** (recommended — a
> regression detector; divergences from the idealized model are documented as GAPs), or encode the
> **desired** shape (so they fail today and gate a hardening pass)? The pilot pins reality and lists
> the gaps; hardening is a separate, later spec. [FILL IN if the user wants the failing-desired
> variant instead.]

- Match the arg-type arrays to the catalog **exactly** — copy from
  `pg_get_function_identity_arguments('todo_api.create_todo'::regprocedure)`; a composite arg is its
  fully-qualified type name (`todo_fn.create_todo_options`), not its columns.
