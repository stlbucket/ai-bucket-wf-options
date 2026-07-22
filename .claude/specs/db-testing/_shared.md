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

Seeding runs **as the owning connection** (`postgres`, superuser + BYPASSRLS), *before*
`test._login()`. FK realities verified from `db/fnb-todo` + `db/fnb-res` govern how much you seed:

- **Immediate FKs must be satisfied at insert time.** `todo.todo.tenant_id → app.tenant(id)` is
  immediate → a tenant row must exist before you insert a todo. `resident_urn → res.resource(urn)`
  is nullable → leave NULL to skip.
- **Deferred id-FKs are safe to skip under ROLLBACK.** `todo.todo`, `app.tenant`, and `app.resident`
  each carry a `DEFERRABLE INITIALLY DEFERRED` FK `(id) → res.resource(id)` (added by
  `db/fnb-res/…011020_res_app_retrofit.sql`) — checked only at COMMIT, which never happens. So a
  direct `INSERT` needs **no** `res.resource` row *for those id-FKs*.
- **BUT the `resident_urn` FK is IMMEDIATE (verified 2026-07-21).** `todo.todo.resident_urn →
  res.resource(urn)` is a plain (non-deferred) FK, and `todo_fn.create_todo` sets
  `resident_urn = _resident.urn`. So any `_fn`/`_api` test that calls `create_todo` **must register
  the resident** in `res.resource` first (its generated urn must exist there) — otherwise
  `todo_resident_urn_fkey` (23503) fires *inside* create_todo. `test._seed_resident` does this via
  `res_fn.register_resource(_id, _tenant_id, 'app','resident')`. RLS-direct table tests that insert
  `todo.todo` with `resident_urn = NULL` don't need it.
- **No trigger side effects.** Registration of tenant/resident lives in `app_fn` **bodies, not
  triggers** — a raw `INSERT INTO app.tenant`/`app.resident` registers nothing and fires nothing.
- **Self-ref NOT NULL:** `root_todo_id NOT NULL REFERENCES todo.todo(id)` → set `root_todo_id = id`
  for a root row.

`_fn`/`_api` behaviour tests that call `todo_fn.create_todo` need a real **tenant + registered
resident** (the resident registered in `res.resource` per the immediate `resident_urn` FK above).
RLS-direct table tests need only the `app.tenant` row(s).

**Resolved (implemented in `db/_test/setup.sql`)** — the helpers take explicit ids so tests stay
deterministic (psql `\set` UUIDs), and use the real, verified column lists:

```sql
-- app.tenant: id, name (citext, not null), type (default 'customer'), status (default 'active')
CREATE OR REPLACE FUNCTION test._seed_tenant(_id uuid, _name text DEFAULT 'test-tenant')
  RETURNS void LANGUAGE sql AS $$
  INSERT INTO app.tenant (id, name, type, status)
  VALUES (_id, _name::citext, 'customer', 'active');
$$;

-- app.resident: profile_id nullable; tenant_name + email + type NOT NULL (no default on type)
CREATE OR REPLACE FUNCTION test._seed_resident(_id uuid, _tenant_id uuid)
  RETURNS void LANGUAGE sql AS $$
  INSERT INTO app.resident (id, profile_id, tenant_id, tenant_name, email, display_name, type, status)
  VALUES (_id, NULL, _tenant_id, (SELECT name FROM app.tenant WHERE id = _tenant_id),
          'resident@test.local', 'Test Resident'::citext, 'home', 'active');
  -- required: create_todo sets todo.resident_urn = resident.urn (IMMEDIATE FK → res.resource.urn)
  SELECT res_fn.register_resource(_id, _tenant_id, 'app', 'resident');
$$;
```

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
- **psql interpolation gotcha (verified 2026-07-21).** psql substitutes only the **`:'var'` quoted
  form**, and **not** inside `$$…$$` dollar-quotes or `'…'` single-quotes. So a `throws_ok`/`lives_ok`
  whose SQL is written `$$ … ':x' … $$` does **not** interpolate — the literal text `:x` reaches the
  server (usually a `22P02`/syntax error, masking the SQLSTATE you meant to assert). Rules: pass
  `:'var'` as a **direct** call arg (outside any quote); to get a value **into** a dollar-quoted SQL
  string, wrap with `format($$ … %L … $$, :'var')`, or avoid it (use `gen_random_uuid()` / a literal
  when the exercised path raises before that arg is read). The illustrative `':tenant_b'` snippets in
  `rls-tests.md`/`api-permission-tests.md`/`fn-behaviour-tests.md` (inherited from the pgtap-expert
  reference) carry this latent bug — the shipped `db/fnb-todo/test/*.sql` are the corrected pattern;
  copy **those**.
- **No data-modifying CTE inside an assertion (verified 2026-07-21).** Postgres allows a
  `WITH … (UPDATE/INSERT/DELETE … RETURNING) …` only at statement top level, so
  `is( (WITH u AS (UPDATE … RETURNING 1) SELECT count(*) FROM u), … )` errors ("must be at the top
  level"). To assert a cross-tenant write is a no-op, run the `UPDATE`/`DELETE` as a **plain
  statement** (0 rows, no raise — the row is RLS-invisible), then `test._logout()` and read the row
  back as owner with `is(...)` to prove it's unchanged.
