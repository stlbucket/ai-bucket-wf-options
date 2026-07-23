# Plan: Systemic missing `SET search_path` on SECURITY DEFINER functions

> **Execution Directive:** Implement via the `sqitch-expert` + `fnb-db-designer` skills.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/security-definer-search-path.plan.md`
> Never run `git` in a sqitch session; never redeploy the DB yourself — ask the user, then verify read-only.

**Severity: HIGH** · Workstream: WS2 (DB security) · Identified: 2026-07-05

## Details

Only two functions in the entire database pin their search_path:
`storage.public_asset` and `storage.public_assets_for_entity`
(`db/fnb-storage/deploy/00000000010615_storage_api.sql:17,25` — `security definer set search_path = ''`).

Every other SECURITY DEFINER function omits it, including:

- **`auth.login_user`** (`db/fnb-auth/deploy/00000000010200_auth.sql:41-56`) — calls **unqualified
  `crypt()`** (pgcrypto). Granted to `anon` via the blanket
  `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated, anon`
  (`00000000010210_auth_roles_and_grants.sql`).
- All `app_fn` definers: `current_profile_claims`, `available_modules`,
  `subscribe_tenant_to_license_pack`, `my_profile_residencies`, `get_ab_listings`,
  `profile_claims_for_user` (`00000000010240_app_fn.sql`, `00000000010260_app_bootstrap.sql`).
- `storage_fn.ensure_storage_resident`, `storage_fn.insert_asset` (`00000000010610_storage_fn.sql`).
- `loc_fn`/`todo_fn`/`msg_fn` `handle_update_profile` + `ensure_*_resident` functions.
- `wf_api.queue_workflow`, `wf_fn.queue_workflow`, `wf_fn.pull_trigger` (`00000000010520_wf_fn.sql`).

### Scope update — 2026-07-22 recurring RLS sweep (0030 leg)

The new `db/fnb-notify` module (landed since 2026-07-19) adds three more unpinned SECURITY DEFINER
functions to this same class — fold them into the same per-package sqitch change when this item is
worked (`db/fnb-notify/deploy/00000000011290_notify_prefs_fn.sql`):

- **`notify_fn.request_phone_verification`** — calls **unqualified `crypt()` + `gen_salt('bf')`**
  (pgcrypto), the exact `auth.login_user` worked-example risk; runs over the `n8n_worker` connection.
- **`notify_fn.verify_phone_code`** — unqualified `crypt()` comparison; also writes `app.profile`.
- **`notify_fn.set_channel_preference`** — no unqualified extension calls, but still DEFINER-unpinned.

(The `notify_api` INVOKER wrappers and the STABLE `notify_api.notifications` reader are correctly
INVOKER and need no pinning. Note: the rest of the notify module is otherwise a *model* of the
correct grant posture — `notify_fn` is granted only to `n8n_worker` + the two prefs functions to
`authenticated`, never to `anon`, so it does not add to `0020__security__fn-schema-grant-bypass`.)

## Implication

A SECURITY DEFINER function without a fixed search_path resolves unqualified identifiers using the
**caller's** search_path. A caller who can create objects in any schema on their path (or set
`search_path` per-session) can shadow functions/operators/tables the definer body references and run
attacker SQL with the definer's privileges. `auth.login_user` + unqualified `crypt()` is the classic
worked example: shadow `crypt(text,text)` earlier on the path and you execute arbitrary code as the
function owner on every login attempt, and can capture plaintext passwords. This is the standard
hardening rule from the PostgreSQL docs (CREATE FUNCTION → "Writing SECURITY DEFINER Functions
Safely") and the single most consistent gap in the tree — notably, the newest code (storage public
readers) already does it right.

## Suggested fix

One sqitch change per package (can share the change with `fn-schema-grant-bypass.plan.md` since both
CREATE OR REPLACE the same functions):

1. For every SECURITY DEFINER function: add `SET search_path = ''` (matching the storage precedent)
   and schema-qualify every reference in the body (`pgcrypto`'s `crypt` → `public.crypt` or
   `extensions.crypt` depending on where extensions install — check
   `db/fnb-auth/deploy/00000000010100_extensions.sql` for the extension schema).
2. Alternative where bodies are large: `SET search_path = pg_catalog, pg_temp` minimizes the
   qualification burden; empty-string + full qualification is stricter and already the house style.
3. While in there, confirm each function actually needs DEFINER; any that work as INVOKER should be
   downgraded (least privilege).
4. Add the rule to `fnb-db-designer` SKILL.md (tracked separately in
   `skill-fnb-db-designer-jwt-schema.plan.md`) so new functions don't regress.

## Verification

- After redeploy: `select proname, prosecdef, proconfig from pg_proc p join pg_namespace n on n.oid=pronamespace where prosecdef and n.nspname not in ('pg_catalog','information_schema')` — every row's `proconfig` contains a `search_path=` entry.
- Login still works (crypt correctly qualified): user runs the stack, I verify login via the running app read-only.
- Full GraphQL smoke on mutations that traverse `_fn` definers (msg upsert_topic, todo create, storage insert via api).
