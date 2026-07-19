# Plan: SECURITY DEFINER `_fn` functions are directly callable — `_api` gates and RLS are bypassable

> **Execution Directive:** Implement via the `sqitch-expert` + `fnb-db-designer` skills.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/fn-schema-grant-bypass.plan.md`
> Never run `git` in a sqitch session; never redeploy the DB yourself — ask the user, then verify read-only.

**Severity: CRITICAL** · Workstream: WS2 (DB security) · Identified: 2026-07-05

## Details

Every module's `*_policies.sql` runs a blanket
`grant all on all routines in schema <module>_fn to anon, authenticated, service_role`
(or `grant execute ... to authenticated` in storage's case). Because `_fn` functions are
SECURITY DEFINER with **no permission checks of their own** (that's the `_api` layer's job per
global-rules R8), the grants make the entire internal business-logic layer a public API that
skips both `jwt.enforce_permission` gates and RLS. Concrete exploitable examples:

1. **`app_fn.current_profile_claims(_profile_id uuid)`** — `db/fnb-app/deploy/00000000010240_app_fn.sql:522`,
   SECURITY DEFINER, granted to **anon**. Takes an arbitrary profile id with no self-check and returns
   that profile's email, display name, tenant, permission list, and module tree. Claims harvesting
   for any user by uuid, unauthenticated.
2. **`app_fn.available_modules(_profile_id)`** — `00000000010240_app_fn.sql:617`, same exposure.
3. **`storage_fn.insert_asset(_info, _resident_id)`** — `db/fnb-storage/deploy/00000000010610_storage_fn.sql:43`,
   SECURITY DEFINER, granted to `authenticated`. An authenticated user can call it directly with an
   **arbitrary `_resident_id`**, bypassing `storage_api.insert_asset`'s
   `jwt.enforce_permission('p:app-user')` gate and spoofing the uploader (and thereby the tenant,
   since tenant is resolved from the resident).
4. **`wf_fn.queue_workflow(_identifier, _tenant_id, ...)`** — `db/fnb-wf/deploy/00000000010520_wf_fn.sql:28`,
   SECURITY DEFINER, anon-callable with an arbitrary tenant id (see also `wf-rls-missing.plan.md`).

Note the `_fn` schemas are correctly NOT exposed to PostGraphile (`pgServices.schemas` in
`apps/graphql-api-app/server/graphile.config.ts` lists only `<module>` + `<module>_api`), so these
are not reachable as GraphQL mutations — but any direct SQL path running as `authenticated`/`anon`
(including a future PostGraphile misconfiguration, a compromised app query, or psql access as
`authenticator` + `SET ROLE`) can call them.

Exception that must be preserved: `app_fn.profile_claims_for_user` is deliberately granted only to
`authenticator` (`db/fnb-app/deploy/00000000010260_app_bootstrap.sql`) — that is the correct model
to generalize.

## Implication

The two-layer security pattern (R8: gate in `_api`, work in `_fn`) is currently decorative for any
caller that names the `_fn` function directly. Personal data disclosure (claims harvesting) is
possible **anonymously**; identity spoofing on writes is possible for any authenticated user.

## Suggested fix

One sqitch change per affected package (deploy + revert + verify), pattern:

1. `revoke all on all routines in schema <module>_fn from anon, authenticated` for every module
   (`app_fn`, `msg_fn`, `todo_fn`, `loc_fn`, `wf_fn`, `storage_fn`).
2. Fix the matching `alter default privileges in schema <module>_fn` statements so future functions
   don't re-open the hole.
3. Grant back only what the architecture actually needs:
   - `_api` (SECURITY INVOKER) calling `_fn` (SECURITY DEFINER): the INVOKER caller must have EXECUTE
     on the `_fn` function. Either grant `_fn` EXECUTE to `authenticated` **per function with an
     in-function guard**, or — cleaner — make each `_fn` owned by a dedicated definer role and grant
     EXECUTE on specific `_fn` functions to `authenticated` **only where an `_api` gate exists in
     front and the function takes no caller-controlled identity parameters** (e.g. change
     `storage_fn.insert_asset` to read `jwt.resident_id()` itself instead of trusting `_resident_id`,
     or keep the parameter but revoke direct EXECUTE and route the grant through the api layer's
     needs).
   - Pre-claims trio (`app_fn.profile_claims_for_user`, `app_fn.current_profile_claims`,
     `auth.login_user`): EXECUTE for `authenticator` only (profile_claims_for_user already does this —
     replicate for `current_profile_claims`, which db-access calls via the authenticator pool:
     `packages/db-access/src/mutations/current-profile-claims.ts`).
   - Trigger functions (`handle_update_profile`, `handle_new_user`, `ensure_*_resident` when only
     trigger/`_fn`-internal): need no role grants at all.
4. Re-check `db/fnb-app/deploy/00000000010242_app_fn_definers.sql` (definer/ownership arrangements)
   so ownership and grants stay coherent.

Sequencing: land together with (or after) `security-definer-search-path.plan.md` — both touch every
`_fn` function and can share sqitch changes per package.

## Verification

- After user redeploys, as anon: `select app_fn.current_profile_claims('<any uuid>')` → permission denied.
- As authenticated (claims set): `select storage_fn.insert_asset(row(...), '<other resident uuid>')` → permission denied; `select * from storage_api.insert_asset(...)` (via GraphQL mutation) still works.
- Full app smoke: login, nav renders (claims assembly still works via authenticator), msg/todo/loc/storage mutations still function through GraphQL.
- `pnpm build` unaffected (SQL-only change).
