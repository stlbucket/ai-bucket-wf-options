# Execution log — 0030_recur__rls-permission-audit — 2026-07-30

Audit-only leg (DB fixes need sqitch changes + a redeploy the agent never runs). The db surface
since 2026-07-23: the **todo multi-assignee refactor** (`00000000010490/10495/10497` +
pgTAP tests under `db/fnb-todo/test/`), the **fnb-app definers consolidation**
(`00000000010230_app_fn_types.sql`, `00000000010242_app_fn_definers.sql`, support/fn/policies
edits — workspace/subtree/participants work), plus touched policies files across most modules
and `fnb-auth` roles/jwt edits.

## New-surface sweep

1. **`todo.todo_assignee`** — RLS enabled ✓; `manage_all_for_tenant` FOR ALL policy
   (`jwt.tenant_id() = tenant_id`, USING + WITH CHECK) — matches the module's existing
   `todo.todo` posture (tenant-fenced, license gate lives in `_api`). Correct table name, no
   copy-paste bug. Proper indexes + `uq_todo_assignee`.
2. **`_api` gates** — `todo_api.add_todo_assignee` / `remove_todo_assignee` both check
   `jwt.has_permission('p:todo')` before delegating ✓ (module's house style; INVOKER
   throughout). `deep_copy_todo` fix (10497) is INVOKER, no new surface.
3. **✗ GAP — unvalidated `_resident_urn`** in `todo_fn.add_todo_assignee`: inserted verbatim
   with only the FK to `res.resource(urn)` — not checked to be a `resident`-type resource nor
   to be in the caller's tenant. Cross-tenant name disclosure + reference corruption via
   direct GraphQL call. **Spawned
   `identified/0640__security__todo-assignee-urn-validation____MED__.plan.md`** (DB-level
   counterpart of the existing `0630` picker-pin item).
4. **`00000000010242_app_fn_definers.sql`** — 21 SECURITY DEFINER functions, **zero
   `search_path` pins**. Folded into the standing `0050` item via a dated scope update (file
   relocation + function list); also noted there that `auth.login_user` (its worked example)
   is dropped at the ZITADEL cutover, so the class survives but the headline example is
   historical.
5. **`jwt.sql`** — all helper functions remain SECURITY INVOKER ✓. `auth_roles_and_grants`
   rework is the guarded CREATE ROLE authenticator (cluster-survival posture) — sound.
6. **Spot-checks of touched policies files** (msg, game, auth) — RLS enable + policy lines
   present per table, correct table names.

## Standing findings re-confirmed (no duplicates spawned)

- `0020__security__fn-schema-grant-bypass` (CRT) — blanket `grant all … to anon, authenticated,
  service_role` on `_fn`/base schemas still present (fnb-app, fnb-todo, fnb-airports, …); the
  new `todo_fn.add_todo_assignee`/`remove_todo_assignee` are INVOKER so they add no *definer*
  bypass, but ride the same blanket grants.
- `0040__security__superuser-database-url` (HI) — `.env` `DATABASE_URL=postgresql://postgres:…`
  unchanged.
- `0050__security__security-definer-search-path` (HI) — scope-updated this run (see above).
- `0060__security__rls-gaps-msg-loc-app` (HI) — unchanged.

## Fixed inline

- `identified/0050__…search-path` — dated scope update (doc edit only).

## Spawned identified/ items

- `0640__security__todo-assignee-urn-validation____MED__.plan.md` (new).

## Gate

No product-code changes this leg (two `identified/*.md` doc edits only); `pnpm build` green as
of the 0020 leg (13/13, full turbo).
