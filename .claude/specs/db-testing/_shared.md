# db-testing — shared conventions (roles, claims, seeds, file layout)

## Status
Draft — fill in all [FILL IN] sections before implementing.

This file is the single source of truth for the pieces every pgTAP test file in every
`db/<pkg>/test/` tree depends on: the "become a user" helpers, the seed helpers, the pgTAP
install location, and the file-naming/plan discipline. Per-category detail lives in
`rls-tests.md`, `api-permission-tests.md`, `fn-behaviour-tests.md`; the runner lives in
`harness.md`. Do not restate the RLS/permission model here — defer to
`.claude/skills/fnb-db-designer/SKILL.md` and `.claude/specs/graphql-api-pattern.md`. For pgTAP
assertion choice/semantics defer to skill `pgtap-expert`.

---

## Locked decisions (see README for the full table + why)

- **Style A — script `.sql` + `pg_prove`** (fallback: `psql` + `finish(true)`), one txn per file,
  `BEGIN … plan() … finish() … ROLLBACK`. pgTAP functions are **never** shipped into the deployed
  schema.
- pgTAP is installed **once** into a dedicated **`tap`** schema on the target DB
  (`CREATE EXTENSION pgtap SCHEMA tap`); the runner puts `tap` on the `search_path`.
- Tests live in **`db/<pkg>/test/`** (sibling of `deploy/ revert/ verify/`). They are **not** sqitch
  changes and are **never** listed in `sqitch.plan`.
- Tests run against the **running dev DB** (the same one PostGraphile serves) via a new
  `scripts/db-test.ts`. Because every file is a rolled-back transaction, tests leave no trace.

---

## Roles & the claims mechanism (what a test must reproduce)

RLS keys off a JSON claims blob in the `request.jwt.claims` GUC that PostGraphile injects per
request via `pgSettings`. `jwt.jwt()` reads `current_setting('request.jwt.claims', true)::jsonb`;
only `user_metadata` matters to the helpers:

```json
{ "user_metadata": {
    "profile_id":  "…uuid…",
    "tenant_id":   "…uuid…",
    "resident_id": "…uuid…",
    "permissions": ["p:todo", "p:app-admin-super"]
} }
```

Helpers in schema `jwt` (all `STABLE SECURITY INVOKER`): `jwt.uid()` (=profile_id),
`jwt.tenant_id()`, `jwt.resident_id()`, `jwt.profile_id()`, `jwt.email()`,
`jwt.user_permissions() → citext[]`, `jwt.has_permission(citext, uuid default null) → boolean`,
`jwt.has_all_permissions(citext[], uuid default null)`, `jwt.enforce_permission(citext, uuid default null)`.

Roles in play: `anon`, `authenticated`, `authenticator`, `service_role`, plus service roles
(`n8n_worker`). A logged-in web request runs as **`authenticated`** with the claims GUC set;
RLS policies call `jwt.tenant_id()` / `jwt.has_permission(...)`.

---

## The `test` helper schema (created by the runner, never deployed)

The runner creates a `test` schema of helper functions **before** running any file, and drops it
after. These are test-only — they never enter `db/<pkg>/deploy/`.

### `test._login` / `test._logout` — become a user

Use `set_config(…, true)` (is_local) + `SET LOCAL ROLE` so everything is scoped to the file's
transaction and vanishes on `ROLLBACK`.

```sql
CREATE OR REPLACE FUNCTION test._login(
  _profile_id uuid,
  _tenant_id  uuid,
  _perms      text[]  DEFAULT '{}',
  _resident_id uuid   DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('user_metadata', jsonb_build_object(
      'profile_id',  _profile_id,
      'tenant_id',   _tenant_id,
      'resident_id', _resident_id,
      'permissions', to_jsonb(_perms)
    ))::text, true);            -- is_local → scoped to txn
  SET LOCAL ROLE authenticated;
END;
$$;

CREATE OR REPLACE FUNCTION test._logout() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;                    -- back to the owning connection (RLS-bypassing)
  PERFORM set_config('request.jwt.claims', '{}', true);
END;
$$;
```

### Seed helpers — satisfy the FK graph as the owner

Seeding runs **as the owning connection** (RLS bypassed), *before* `test._login()`. Two FK
realities from `db/fnb-todo` govern how much you must seed:

- **Immediate FKs must be satisfied at insert time.** `todo.todo.tenant_id → app.tenant(id)` is
  immediate → a tenant row must exist before you insert a todo. Same for
  `resident_urn → res.resource(urn)` (nullable — leave NULL to skip) and any resident.
- **Deferred FKs are safe to skip under ROLLBACK.** `fk_todo_resource (id) → res.resource(id)` is
  `DEFERRABLE INITIALLY DEFERRED` — checked only at COMMIT, which never happens (we `ROLLBACK`). So
  a direct `INSERT INTO todo.todo` **without** a matching `res.resource` row is fine for RLS tests.
- **Self-ref NOT NULL:** `root_todo_id NOT NULL REFERENCES todo.todo(id)` → set `root_todo_id = id`
  for a root row.

`_fn` behaviour tests that call `todo_fn.create_todo` (which itself calls
`res_fn.register_resource` and reads `app.resident`) need a real **tenant + resident** seeded. Give
`_shared` a `test._seed_tenant(...)` and `test._seed_resident(...)` returning the created ids.

```sql
-- Minimal example — REAL column lists come from db/fnb-app (app.tenant, app.resident). [FILL IN]
-- with the actual required columns when implementing (fnb-db-designer owns that schema).
CREATE OR REPLACE FUNCTION test._seed_tenant(_name text DEFAULT 'test-tenant')
  RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE _id uuid; BEGIN
  -- INSERT INTO app.tenant (...) VALUES (...) RETURNING id INTO _id;   -- [FILL IN]
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION test._seed_resident(_tenant_id uuid)
  RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE _id uuid; BEGIN
  -- INSERT INTO app.resident (...) VALUES (...) RETURNING id INTO _id;  -- [FILL IN]
  RETURN _id;
END; $$;
```

> **Open question (see README):** are the seed helpers hand-written per the real `app.tenant` /
> `app.resident` shape, or should the suite reuse `db/seed.sql`? Resolve with `fnb-db-designer`
> before the pilot lands. The pilot's value depends on these being correct.

---

## File layout & naming

```
db/<pkg>/test/
  000-setup.sql          -- (optional) pkg-local helper fns beyond test._* ; still BEGIN…ROLLBACK
  010-rls.sql            -- RLS-direct-on-tables      (rls-tests.md)
  020-api-permissions.sql-- permission gate + grant shape on <module>_api (api-permission-tests.md)
  030-fn-behaviour.sql   -- <module>_fn functionality (fn-behaviour-tests.md)
```

- Numeric prefixes set run order within a package; `pg_prove` also sorts lexically.
- One `SELECT plan( N )` per file with an **explicit** count — a plan mismatch is itself a failure
  (catches "assertion silently didn't run"). Update `N` when you add assertions.
- End every file with `SELECT * FROM finish();` then `ROLLBACK;` (the harness's psql-fallback path
  uses `finish(true)` — see `harness.md`).
- **Seed as owner, probe as `authenticated`.** Do all seed inserts before `test._login()`; switch
  role, then assert the policy/permission.
- Assert **negative** cases explicitly (`is_empty`, `throws_ok(…, '42501')`, `throws_ok(…,'30000')`).
  A suite that only checks the happy path proves nothing about isolation.

## Assertion cheat-sheet (defer to skill `pgtap-expert` for full semantics)

- RLS-filtered selects have **no guaranteed order** → use `set_eq` / `bag_eq`, never `results_eq`.
- RLS `WITH CHECK` / grant denials raise SQLSTATE **`42501`** (insufficient_privilege).
- The stack's own `raise exception '30000: …'` / `'30028…'` etc. surface as SQLSTATE **`P0001`**
  with that message text → assert with `throws_ok(sql, 'P0001', NULL, 'label')` or match the message.
- `citext` columns/args: `col_type_is(…, 'citext')`; pass permission arrays as plain `text[]`.
- Match `_fn`/`_api` arg-type arrays to the catalog **exactly** — copy from
  `pg_get_function_identity_arguments`, not from memory.
