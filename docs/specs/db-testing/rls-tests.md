# db-testing — RLS tests (direct on tables)

## Status
Draft — fill in all [FILL IN] sections before implementing.

**What this covers:** the user's "RLS tests direct on tables" — assert each module table's RLS
policy directly, with no `_api`/`_fn` function in the path. Set a role + claims, then run raw
`SELECT/INSERT/UPDATE/DELETE` against the table and assert what the policy allows and denies.
Prereqs: `_shared.md` (the `test._login/_logout` + seed helpers, plan discipline, assertion notes).

File: `db/<pkg>/test/010-rls.sql`.

---

## Ground truth for the pilot (`db/fnb-todo`)

`todo.todo` has RLS enabled with **one** policy (`db/fnb-todo/deploy/00000000010480_todo_policies.sql`):

```sql
alter table todo.todo enable row level security;
CREATE POLICY manage_all_for_tenant ON todo.todo
  FOR ALL
  USING      (jwt.tenant_id()::uuid = tenant_id)
  WITH CHECK (jwt.tenant_id()::uuid = tenant_id);
```

**Read this before writing the test — the policy is tenant-only:**

- Isolation is by **`tenant_id` alone**. There is **no permission predicate** in the policy and
  **no super-admin bypass** — `p:app-admin-super` does *not* widen visibility here (unlike the
  idealized "widget" example in the pgtap-expert skill; do not copy that verbatim).
- `FOR ALL` → the same predicate gates SELECT/INSERT/UPDATE/DELETE. Cross-tenant **writes** are
  denied by `WITH CHECK` (SQLSTATE `42501`); cross-tenant **reads** simply return zero rows.
- The table does **not** have `FORCE ROW LEVEL SECURITY`, so the owning connection bypasses RLS →
  seed as owner, probe as `authenticated`.

## Seeding (per `_shared.md` FK notes)

- `tenant_id → app.tenant(id)` is **immediate** → seed two `app.tenant` rows (`tenant_a`, `tenant_b`)
  as owner first. [FILL IN real `app.tenant` columns — owned by `db/fnb-app`; confirm with
  `fnb-db-designer`.]
- `fk_todo_resource (id) → res.resource(id)` is **deferred** → safe to skip under `ROLLBACK`; a raw
  `INSERT INTO todo.todo` needs no `res.resource` row.
- `root_todo_id` is `NOT NULL` self-ref → set `root_todo_id = id`. `ordinal` `NOT NULL` → provide.
  `name` has `CHECK (char_length(name) >= 3)`.

## Canonical shape

```sql
BEGIN;
SELECT plan( 6 );

-- ── seed as owner (RLS bypassed) ────────────────────────────────────────────
SELECT test._seed_tenant('tenant-a');   -- returns :tenant_a  [or INSERT directly]
SELECT test._seed_tenant('tenant-b');   -- returns :tenant_b
INSERT INTO todo.todo (id, tenant_id, root_todo_id, name, ordinal)
VALUES (:'a1', :'tenant_a', :'a1', 'a-widget-todo', 0),
       (:'b1', :'tenant_b', :'b1', 'b-widget-todo', 0);

-- ── tenant A sees only its own rows ─────────────────────────────────────────
SELECT test._login( :'profile_a', :'tenant_a', ARRAY['p:todo'] );
SELECT set_eq(
  'SELECT name::text FROM todo.todo',
  ARRAY['a-widget-todo'],
  'tenant A sees only tenant A todos' );
SELECT is_empty(
  $$ SELECT 1 FROM todo.todo WHERE tenant_id <> jwt.tenant_id()::uuid $$,
  'tenant A cannot see other tenants even by explicit filter' );

-- ── cross-tenant write denied by WITH CHECK ─────────────────────────────────
SELECT throws_ok(
  format($$ INSERT INTO todo.todo (id, tenant_id, root_todo_id, name, ordinal)
            VALUES (gen_random_uuid(), %L, gen_random_uuid(), 'sneaky', 0) $$, :'tenant_b'),
  '42501', NULL,
  'tenant A cannot INSERT a tenant B row' );
SELECT throws_ok(
  $$ UPDATE todo.todo SET name = 'hijack' WHERE id = ':b1'::uuid $$,
  NULL, NULL,   -- UPDATE matches zero visible rows → no-op, not a raise; assert row-count instead
  'tenant A UPDATE of a tenant B row affects nothing' );  -- [FILL IN] see note below

-- ── super-admin does NOT bypass this tenant-only policy ──────────────────────
SELECT test._login( :'profile_admin', :'tenant_a', ARRAY['p:app-admin-super'] );
SELECT set_eq(
  'SELECT name::text FROM todo.todo',
  ARRAY['a-widget-todo'],
  'p:app-admin-super still only sees its own tenant (policy is tenant-only)' );

-- ── anon (no claims) sees nothing ───────────────────────────────────────────
SELECT test._logout();
SELECT set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE anon;
SELECT is_empty( 'SELECT 1 FROM todo.todo', 'anon sees no rows' );

SELECT * FROM finish();
ROLLBACK;
```

> **Note on the UPDATE/DELETE negative case:** a cross-tenant `UPDATE`/`DELETE` doesn't *raise* —
> the row is simply invisible, so it matches zero rows and is a silent no-op. Assert that with a
> row-count check (`is( (WITH u AS (UPDATE … RETURNING 1) SELECT count(*) FROM u)::int, 0, …)`) or a
> post-condition `is_empty`, **not** `throws_ok`. Only writes that would land in another tenant
> (fail `WITH CHECK`) raise `42501`. Decide the exact assertion set at implement time and set
> `plan(N)` accordingly.

## What to assert for every RLS table (checklist to apply per package)

1. `has_table` + RLS is on: `is( (SELECT relrowsecurity FROM pg_class WHERE oid = 'todo.todo'::regclass), true, …)`.
2. Tenant A sees only tenant A (`set_eq`); other tenants invisible even by explicit filter (`is_empty`).
3. Cross-tenant **write** denied (`throws_ok(…, '42501')`); cross-tenant update/delete is a no-op.
4. `anon` (empty claims) sees nothing / cannot write.
5. **Cover both branches of any conditional policy.** Several stack policies special-case
   `tenant_id IS NULL` (e.g. `n8n.workflow_run`'s super-admin view). `todo` has none, but the
   rollout packages do — test both the tenant-scoped and the null-tenant path or you miss half.
