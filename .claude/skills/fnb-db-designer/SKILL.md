---
name: fnb-db-designer
description: >
  Expert in the fnb project's database design patterns — schema layout, permission model,
  RLS policies, function conventions, and license-based access control. Use this skill when
  the user asks to design a new table, add permissions, create a sqitch change, wire up RLS
  policies, or asks "how do we handle X in the database?" for the fnb project. Also triggers
  when the user asks how the auth/permission system works or how to extend it.
---

# FNB Database Designer

You are an expert in this project's PostgreSQL database design. When helping with database work,
apply the patterns below consistently. Always cite a specific migration file as evidence when
explaining a pattern. The deploy files under `db/*/deploy/` are the source of truth — if this
document and a deploy file disagree, the deploy file wins.

---

## Packages and Schema Layout

Ten sqitch packages, deployed in the order set by `DEPLOY_PACKAGES` in `.env`
(`fnb-auth fnb-app fnb-res fnb-msg fnb-todo fnb-loc fnb-wf fnb-storage fnb-location-datasets fnb-airports`; `fnb-res` (the URN registry) precedes every registering module; `fnb-wf` must precede
`fnb-storage`). `db/my-app` is cruft — never extend it.

Cross-cutting schemas (from `fnb-auth` / `fnb-app`):

| Schema | Purpose |
|---|---|
| `jwt` | Claims helpers — `jwt.uid()`, `jwt.jwt()`, `jwt.user_permissions()`, `jwt.has_permission()`, `jwt.tenant_id()`, `jwt.resident_id()`, `jwt.profile_id()` and friends. Read `request.jwt.claims` set per-request via pgSettings. |
| `auth` | Sessions (`auth.session`) and legacy shims. **`auth.user` is dropped** (`db/fnb-app/deploy/00000000010280_drop_auth_user.sql`) — ZITADEL owns identity; do not design against it. |
| `app` | The anchor module: tenants, residents, profiles, licenses, permissions. Source of truth for all shared data. |
| `app_fn` | Internal business logic + composite types. `SECURITY DEFINER` only for trusted pre-claims / cross-tenant operations. |
| `app_api` | Public API surface (exposed via PostGraphile). Always `SECURITY INVOKER`. Delegates to `app_fn.*`. Permission checks happen here. |

Every feature module repeats the same trio: `<module>` (tables/enums), `<module>_fn` (internal
logic + types), `<module>_api` (PostGraphile surface). Example: `todo` / `todo_fn` / `todo_api`
in `db/fnb-todo/deploy/00000000010450_todo.sql` and `00000000010470_todo_fn.sql`.

Reference: `db/fnb-auth/deploy/00000000010150_jwt.sql`, `db/fnb-app/deploy/00000000010220_app.sql`

---

## Auth & Permission Flow

ZITADEL owns the login ceremony (OIDC code+PKCE — see
`.claude/specs/future-auth/zitadel-login-pattern.md`). There is no password path.

```
ZITADEL id_token (verified in auth-app callback)
  ↓ app_fn.provision_idp_user — maps idp_user_id → app.profile   (00000000010270)
  ↓ auth.session row created; its id sealed into the httpOnly `session` cookie  (00000000010290)
  ↓ per request: claims (ProfileClaims) → pgSettings 'request.jwt.claims' via PostGraphile
    grafast context (or db-access withClaims outside GraphQL)
  ↓ jwt.jwt() reads current_setting('request.jwt.claims')
  ↓ jwt.user_permissions() reads user_metadata.permissions: ["p:app-user", "p:todo", ...]
  ↓ jwt.has_permission('p:some-permission', optional_tenant_id)
  ↓ used in RLS USING clauses and <module>_api function guards
```

Key functions in `db/fnb-auth/deploy/00000000010150_jwt.sql`:
- `jwt.jwt()` — the full claims jsonb from `request.jwt.claims` (empty object if unset)
- `jwt.uid()` / `jwt.profile_id()` / `jwt.tenant_id()` / `jwt.resident_id()` /
  `jwt.actual_resident_id()` / `jwt.email()` / `jwt.display_name()` — scalar claim accessors
- `jwt.user_permissions()` — `citext[]` from `user_metadata.permissions`
- `jwt.has_permission(_key, _tenant_id?)` — array membership + optional tenant scope
- `jwt.has_all_permissions(_keys, _tenant_id?)` — prefix-match across multiple keys
- `jwt.enforce_permission(_key, _tenant_id?)` / `jwt.enforce_any_permission(_keys, _tenant_id?)`
  — raise `30000: NOT AUTHORIZED` on failure

Claims themselves are assembled by `app_fn.current_profile_claims()` and fetched pre-claims by
`app_fn.profile_claims_for_user()` (`db/fnb-app/deploy/00000000010260_app_bootstrap.sql`).

### Permission key naming convention
All permission keys use the `p:` prefix: `p:app-user`, `p:app-admin`, `p:app-admin-super`, `p:todo`, etc.

### License type hierarchy (assignment_scope)
```
superadmin  →  p:app-admin-super (cross-tenant platform control)
admin       →  p:app-admin (manage own tenant)
user        →  p:app-user (basic access)
support     →  p:app-admin-support (support role, hidden from tenant views)
all         →  granted to every user regardless of scope (e.g. p:address-book)
```

Each user holds exactly one scoped license per application. Granting a new scoped license
removes all prior scoped licenses for that application (`app_fn.grant_user_license`).

Reference: `db/fnb-app/deploy/00000000010240_app_fn.sql` (grant_user_license, ~line 800)

---

## RLS Pattern

Every table in a module schema follows this pattern:

1. **Schema grants**: `grant all on all tables/routines/sequences in schema <module> to anon, authenticated, service_role` — broad grants at the schema level, RLS does the real restriction.
2. **Enable RLS**: `alter table <module>.<table> enable row level security;`
3. **Policies**: Use `jwt.has_permission('p:some-permission', optional_tenant_id)` in `USING` clauses.

Policy tiers seen across tables:
- `view_self` / `update_self` — identity check via `jwt.uid() = id`
- `view_own_tenant_*` — tenant-scoped access via `jwt.has_permission('p:app-admin', tenant_id)`
- `manage_*` — superadmin catch-all via `jwt.has_permission('p:app-admin-super')`
- `view_all_users` — public catalog tables (application, license_pack, permission) use `USING (1=1)`
- **deny-all** — pre-claims tables like `auth.session`: enable RLS with **no policies** and
  explicitly `revoke all ... from anon, authenticated, service_role`; only `SECURITY DEFINER`
  functions touch the table (`db/fnb-app/deploy/00000000010290_session.sql`)

Reference: `db/fnb-app/deploy/00000000010250_app_policies.sql`, `db/fnb-todo/deploy/00000000010480_todo_policies.sql`

---

## Function Convention

### `<module>_api` functions (public API)
- `SECURITY INVOKER` — runs as the calling role
- Performs permission checks explicitly:
  `if jwt.has_permission('p:app-admin') != true then raise exception '30000: NOT AUTHORIZED'; end if;`
  (or `perform jwt.enforce_permission(...)`)
- Delegates all logic to a matching `<module>_fn.*` function
- Passes `jwt.*` values (uid, tenant_id, resident_id, email) into `<module>_fn.*` so the inner
  function is testable without claims

### `<module>_fn` functions (internal logic)
- `SECURITY INVOKER` by default
- Use `SECURITY DEFINER` only when the function must bypass RLS for a trusted operation:
  cross-tenant reads (`invite_user`), license writes (`subscribe_tenant_to_license_pack`), and
  the **pre-claims root of trust** functions called via `db-access` raw pg before any claims
  exist (`provision_idp_user`, the `auth.session` functions, `profile_claims_for_user`) —
  these deliberately have **no** `_api` wrapper and no `jwt.*` gate, and pin `search_path`
  to `pg_catalog, public` (citext operators live in `public`; `''` breaks them)
- Accept explicit parameters — never call `jwt.*` helpers directly (that's the `_api` layer's job)

### Composite types
Defined in `<module>_fn` schema (e.g. `app_fn.profile_claims`, `app_fn.paging_options`,
`todo_fn.search_todos_options`). Used as structured return types and input aggregators.

Reference: `db/fnb-app/deploy/00000000010230_app_fn_types.sql`

---

## Table Design Conventions

- Primary keys: `id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY` (for entity tables)
- Lookup/config tables: `key citext PRIMARY KEY` (no UUID, key is the identity)
- Timestamps: `created_at timestamptz not null default current_timestamp`, `updated_at timestamptz not null default current_timestamp`
- Text fields: `citext` (case-insensitive) for emails, names, keys, identifiers
- Enums: defined in the `<module>` schema, named `<module>.<entity>_<attribute>` (e.g. `todo.todo_status`)
- **New tables default their PK to `res_fn.uuid_generate_v7()`** (time-ordered; forward-only
  convention from the urn-registry spec — existing tables keep `gen_random_uuid()`)
- **Registered business tables** (urn-registry, `.claude/specs/urn-registry/`): generated
  `urn` column (`res_fn.build_urn(tenant_id,'<module>','<type>',id)` STORED + UNIQUE), a
  `DEFERRABLE INITIALLY DEFERRED` FK `(id) REFERENCES res.resource(id)`, and
  `res_fn.register_resource(...)` in every `_fn` create path (archive at deletes). Add the
  module to `res.module_permission`.
- **Resident references are URN columns**: `<role>_resident_urn text REFERENCES
  res.resource(urn)` — never uuid FKs to per-module mirror tables. The
  `<module>_tenant`/`<module>_resident` mirror pattern (with `ensure_<module>_resident` and
  the `handle_update_profile` trigger) is **retired** — display names live on `app.resident`
  (tenant-wide RLS) and resolve through the registry.
- `tenant_id` stays `uuid not null references app.tenant(id)` — it is the RLS key and a
  `build_urn` input, not a business reference
- Indexes: always index FK columns; add `unique` indexes for business-logic uniqueness constraints
- Partial unique indexes used for complex invariants (e.g. `WHERE status = 'active'`, `WHERE type = 'home'`)

Reference: `db/fnb-app/deploy/00000000010220_app.sql` (constraints/indexes section)

---

## Extending the Permission System

To add a new feature with its own permission:

1. Register the application via `app_fn.install_basic_application()` (standard user/admin
   license structure) or `app_fn.install_application()` with a full `app_fn.application_info`
   (custom hierarchies) — both in `db/fnb-app/deploy/00000000010240_app_fn.sql`. These insert
   `app.permission` and `app.license_type_permission` rows; `install_basic_application` derives
   `p:<key>-user` / `p:<key>-admin` keys automatically
2. Add RLS policies on new tables using `jwt.has_permission('p:feature-name')`
3. Gate `<module>_api` mutation functions with explicit `jwt.has_permission()` /
   `jwt.enforce_permission()` checks

For the full stack above the DB (PostGraphile exposure, codegen, composables), hand off to the
**fnb-stack-implementor** skill; for sqitch mechanics (plan entries, rework, deploy), see
**sqitch-expert**.

---

## What NOT to do

- Never call `jwt.*` functions inside `<module>_fn.*` — pass values as parameters instead
- Never skip RLS on a table that holds tenant-scoped data
- Never grant a new scoped license without removing the old one (use `grant_user_license`, not direct insert)
- Never expose `<module>_fn.*` functions directly — all public access goes through `<module>_api.*`
- Never design against `auth.user` — it is dropped; identity is `app.profile.idp_user_id` + `auth.session`
- Never hardcode tenant IDs or permission keys as string literals in application code
- Never run `git` during a sqitch session, and never rebuild/restart the env yourself (CLAUDE.md)
