# Plan: `jwt.has_all_permissions` references an undeclared variable (latent runtime error) + `has_permission` null-tenant gotcha

> **Execution Directive:** Implement via the `sqitch-expert` + `fnb-db-designer` skills.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/jwt-has-all-permissions-bug.plan.md`
> Never run `git` in a sqitch session; never redeploy the DB yourself — ask the user, then verify read-only.

**Severity: MEDIUM** (latent — not currently called) · Workstream: WS2 (DB security) · Identified: 2026-07-05

## Details

In `db/fnb-auth/deploy/00000000010150_jwt.sql`:

1. **`jwt.has_all_permissions(_permission_keys citext[], ...)` is broken.** The body references an
   undeclared `_permission_key` (singular) in a `perm LIKE _permission_key || '%'` expression — the
   declared parameter is `_permission_keys` (plural). Calling it raises
   `column/parameter "_permission_key" does not exist` at runtime. Additionally the logic is a
   prefix-`LIKE` match against a single key, which does not implement "has ALL of these permissions"
   semantics the name promises. It is currently referenced only in a commented-out msg policy
   (`db/fnb-msg/deploy/00000000010420_msg_policies.sql`), so it is latent — but it's a loaded
   footgun for the next policy author.

2. **`jwt.has_permission(_permission_key, _tenant_id default null)` silently skips the tenant check
   when `_tenant_id` is null.** The body only ANDs `jwt.tenant_id() = _tenant_id` when the arg is
   non-null. Any policy or `_api` gate that calls `jwt.has_permission('p:x')` (one-arg form) gets a
   **tenant-agnostic** permission check. That is intentional for global permissions
   (`p:app-admin-super`), but it means a one-arg call on a tenant-scoped table is a quiet
   cross-tenant hole. Several `_api` gates use the one-arg form deliberately
   (e.g. `msg_api.*` → `jwt.enforce_permission('p:discussions')`) and rely on RLS for tenant
   scoping — that layering is fine **only where RLS actually exists** (see `wf-rls-missing.plan.md`
   and `rls-gaps-msg-loc-app.plan.md` for where it doesn't).

## Implication

(1) is a guaranteed runtime exception the moment someone uncomments or writes a policy using
`has_all_permissions` — worst case during a deploy that then half-applies. (2) is a design property
that is safe today only by convention; undocumented, it invites future tenant-scoping bugs.

## Suggested fix

One sqitch change in `db/fnb-auth` (rework/corrective change for the jwt schema):

1. Fix `jwt.has_all_permissions` to real semantics:
   `SELECT _permission_keys <@ jwt.user_permissions()` (array containment — caller's permissions
   must include every requested key), with the same optional `_tenant_id` AND as `has_permission`.
   Or, if nothing will use it, **drop the function** — dead security code is worse than no code.
2. Document the null-tenant behavior of `has_permission` in the function's `COMMENT ON FUNCTION`
   and in the `fnb-db-designer` skill (tracked in `skill-fnb-db-designer-jwt-schema.plan.md`):
   "one-arg form = global check; tenant-scoped tables must pass `tenant_id` or rely on an
   RLS policy that does."
3. Sweep existing policies/gates for one-arg `has_permission` calls on tenant-scoped tables and
   confirm each has an RLS backstop (`grep -rn "has_permission('p:" db/*/deploy/`).

## Verification

- `select jwt.has_all_permissions(array['p:app-user']::citext[])` runs without error (returns false with no claims set).
- With a claims payload set via `set_config`, containment semantics verified for subset/superset cases.
- `pnpm db-rebuild` (user-run) deploys clean; existing policies unaffected.
