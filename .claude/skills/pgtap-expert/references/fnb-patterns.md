# pgTAP in the fnb stack

pgTAP is a **generic technology reference** — it is **not currently wired into this repo**. Read
this file when you actually want to *add* database unit tests to fnb, so they match the stack's
conventions instead of fighting them. For sqitch mechanics defer to skill `sqitch-expert`; for
the RLS/permission model itself defer to skill `fnb-db-designer` and
`.claude/specs/graphql-api-pattern.md`.

## What the DB does today (so pgTAP doesn't duplicate it)

- Each sqitch change has a `verify/*.sql` that uses the **divide-by-zero trick**, e.g.
  `select 1/count(*) from pg_roles where rolname = 'n8n_worker';` and
  `select pg_catalog.has_function_privilege('n8n_worker', 'n8n_fn.begin_run(citext, text, jsonb, uuid)', 'execute');`.
  These are *deploy-time smoke checks* — "did this change land" — run by `sqitch verify`. They are
  **not** behavioural tests and don't set an RLS context.
- pgTAP's role is the layer above that: **behavioural** unit tests — does an RLS policy actually
  hide other tenants' rows? does `<module>_api.foo()` raise the right error for an unpermitted
  caller? does a trigger populate the column? Keep pgTAP tests **separate** from `verify`; don't
  convert working `verify` scripts to pgTAP.

## The claims mechanism you must reproduce in a test

RLS keys off a JSON claims blob in the `request.jwt.claims` GUC (PostGraphile injects it via
`pgSettings` per request). `jwt.jwt()` reads it:

```sql
current_setting('request.jwt.claims', true)::jsonb
```

Shape (only `user_metadata` matters to the helpers):

```json
{ "user_metadata": {
    "profile_id":  "…uuid…",
    "tenant_id":   "…uuid…",
    "resident_id": "…uuid…",
    "permissions": ["p:app-admin-super", "p:todo-edit"]
} }
```

Helpers in schema `jwt` (all `STABLE SECURITY INVOKER`, read that GUC):
`jwt.uid()` (= profile_id), `jwt.tenant_id()`, `jwt.resident_id()`, `jwt.profile_id()`,
`jwt.email()`, `jwt.user_permissions() → citext[]`,
`jwt.has_permission(_permission_key citext, _tenant_id uuid default null) → boolean`,
`jwt.has_all_permissions(citext[], uuid default null)`,
`jwt.enforce_permission(citext, uuid default null)` (raises if missing).

Roles in play: `anon`, `authenticated`, `authenticator`, `service_role`, and service roles like
`n8n_worker`. A logged-in web request runs as `authenticated` with the claims GUC set; RLS
policies call `jwt.has_permission('p:…', tenant_id)`.

### The reusable "become this user" helper

Put this at the top of an RLS test file (or in a `startup`/`setup` fn). Use `SET LOCAL` so it's
scoped to the surrounding transaction and vanishes on `ROLLBACK`:

```sql
-- become an authenticated user with the given tenant + permissions
CREATE OR REPLACE FUNCTION test._login(
  _profile_id uuid,
  _tenant_id  uuid,
  _perms      text[] DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('user_metadata', jsonb_build_object(
      'profile_id',  _profile_id,
      'tenant_id',   _tenant_id,
      'permissions', to_jsonb(_perms)
    ))::text,
    true                                  -- is_local = true → scoped to txn
  );
  SET LOCAL ROLE authenticated;
END;
$$;

-- drop back to no-claims anon
CREATE OR REPLACE FUNCTION test._logout() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;                             -- back to the test superuser/authenticator
  PERFORM set_config('request.jwt.claims', '{}', true);
END;
$$;
```

## RLS behaviour test — the canonical shape

```sql
BEGIN;
SELECT plan( 4 );

-- seed as superuser (RLS bypassed for the table owner)
INSERT INTO app.widget (id, tenant_id, name) VALUES
  (1, :'tenant_a', 'a-widget'),
  (2, :'tenant_b', 'b-widget');

-- tenant A, no special perms: sees only its own row
SELECT test._login( :'profile_a', :'tenant_a', ARRAY['p:widget-read'] );
SELECT set_eq(
  'SELECT name FROM app.widget',
  ARRAY['a-widget'],
  'tenant A sees only tenant A widgets'
);
SELECT is_empty(
  $$ SELECT * FROM app.widget WHERE tenant_id = ':tenant_b'::uuid $$,
  'tenant A cannot see tenant B rows even by explicit filter'
);

-- write into another tenant must be denied by the policy
SELECT throws_ok(
  $$ INSERT INTO app.widget (id, tenant_id, name)
     VALUES (3, ':tenant_b'::uuid, 'sneaky') $$,
  '42501',                                -- insufficient_privilege (RLS WITH CHECK)
  NULL,
  'tenant A cannot insert into tenant B'
);

-- super admin sees everything
SELECT test._login( :'profile_admin', :'tenant_a', ARRAY['p:app-admin-super'] );
SELECT set_eq(
  'SELECT name FROM app.widget',
  ARRAY['a-widget','b-widget'],
  'super admin sees all tenants'
);

SELECT * FROM finish();
ROLLBACK;                                 -- seeds + role changes all vanish
```

Notes:
- `set_eq` (not `results_eq`) — RLS-filtered selects have no guaranteed order.
- Assert **negative** cases with `is_empty` and `throws_ok('…','42501')` — the whole point of RLS
  is what a user *can't* do. A test that only checks the happy path proves nothing about isolation.
- `SET LOCAL` / `set_config(…, true)` keep everything inside the txn; the final `ROLLBACK` is your
  cleanup. This is why pgTAP suits RLS testing — you assume a role, probe, and leave no trace.

## Testing the `_fn` / `_api` two-layer

The stack splits each module into `<module>_fn` (privileged internals, often `SECURITY DEFINER`)
and `<module>_api` (the callable surface PostGraphile exposes). pgTAP checks both the **grant
shape** and the **behaviour**:

```sql
-- grant shape: only authenticated may EXECUTE the api fn; fn stays internal
SELECT function_privs_are(
  'todo_api', 'add_todo', ARRAY['citext','uuid'],
  'authenticated', ARRAY['EXECUTE'] );
SELECT function_privs_are(
  'todo_fn', 'insert_todo', ARRAY['citext','uuid'],
  'authenticated', ARRAY[]::text[] );        -- authenticated has NO direct access
SELECT is_definer( 'todo_fn', 'insert_todo', ARRAY['citext','uuid'] );

-- behaviour: api enforces permission
SELECT test._login( :'profile_a', :'tenant_a', ARRAY[]::text[] );  -- missing p:todo-edit
SELECT throws_ok(
  $$ SELECT todo_api.add_todo('buy milk', ':tenant_a'::uuid) $$,
  NULL, NULL,
  'add_todo without p:todo-edit is rejected' );
```

Match the `arg_types` array to the catalog exactly — copy from
`pg_get_function_identity_arguments`, or from the `verify` script that already names the signature
(e.g. `n8n_fn.begin_run(citext, text, jsonb, uuid)`).

## Where tests would live & how they'd run

- A `db/<pkg>/test/` tree of `.sql` files (script style) run with
  `pg_prove -d "$PGDATABASE" db/<pkg>/test/*.sql` against a **disposable** database that has had
  the sqitch packages deployed and `CREATE EXTENSION pgtap`. Keep pgTAP out of the deployed prod
  schema.
- Or a dedicated sqitch `test` schema of `test_*()` functions run with `SELECT runtests('test')`
  — but that ships the functions into the DB, so prefer script style unless you want them
  redeployable.
- Never add `git`/sqitch mutations here yourself — per repo rules, deploy/verify/commit are
  human-run. Write the tests; hand the run to the user.

## Gotchas specific to this stack

- **Seed as the owner, probe as `authenticated`.** Table owners bypass RLS, so do inserts before
  `test._login()`, then switch role to test the policy.
- **`FORCE ROW LEVEL SECURITY`**: if a table has it, even the owner is subject to RLS — seed via a
  `SECURITY DEFINER` helper or a service role, or the seed itself trips the policy.
- **`citext` identifiers**: permission keys and many names are `citext`. `col_type_is(...,'citext')`,
  and pass permission arrays as plain text — `jwt.user_permissions()` returns `citext[]`.
- **`request.jwt.claims` must be valid JSON** — an empty/absent GUC makes `jwt.jwt()` return `{}`
  and every helper return NULL, which usually reads as "anon". Set it explicitly per test.
- **`tenant_id IS NULL` branches**: several policies (see `n8n.workflow_run`'s
  `view_runs_super_admin`) special-case a null tenant. Cover both the tenant-scoped and the
  null-tenant path or you miss half the policy.
