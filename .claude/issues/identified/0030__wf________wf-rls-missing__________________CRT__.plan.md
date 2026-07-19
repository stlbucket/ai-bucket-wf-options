# Plan: fnb-wf has no RLS at all — cross-tenant read/write on all workflow tables

> **MOOTED 2026-07-17 — the wf module no longer exists.** `db/fnb-wf` (and every table this
> plan covers) was retired by the agentic workflow engine migration
> (`0015__wf________agentic-workflow-engine_________MED__`, R22). The one piece of residue —
> ungated `queueWorkflow` — is replaced by the `triggerWorkflow` extendSchema plugin's claims
> gate + static allow-map (graphql-api-app `server/graphile/trigger-workflow.plugin.ts`); the
> successor run log has RLS from day one (`db/fnb-agent` policies). Nothing left to implement.

> ~~**Execution Directive:** Implement via the `sqitch-expert` + `fnb-db-designer` skills.~~

**Severity: CRITICAL** · Workstream: WS2 (DB security) · Identified: 2026-07-05

## Details

`db/fnb-wf/deploy/00000000010580_wf_policies.sql` grants full access but the entire RLS block is
commented out:

- The file runs `grant all on all tables in schema wf to anon, authenticated, service_role` (plus
  matching `alter default privileges`).
- Every `alter table wf.<t> enable row level security` line and every `CREATE POLICY` for `wf.wf`
  is commented out (`--` prefixed).
- None of the five tables (`wf.wf_type`, `wf.wf`, `wf.uow`, `wf.wf_role`, `wf.uow_dependency`)
  has RLS enabled.

Compounding structural gaps in `db/fnb-wf/deploy/*`:
- `wf.wf.tenant_id` and `wf.uow.tenant_id` are bare `uuid NOT NULL` with **no FK** to `app.tenant`.
- fnb-wf has **no shadow tables** (`wf.wf_tenant`, `wf.wf_resident`) — every other module has them
  (see `db/fnb-storage/deploy/00000000010600_storage.sql` for the current best-practice shape).
- `wf_fn.queue_workflow(_identifier, _tenant_id, ...)` (`00000000010520_wf_fn.sql:28`) is
  SECURITY DEFINER and callable by anon with an arbitrary `_tenant_id` (see companion issue
  `fn-schema-grant-bypass.plan.md`).

Added 2026-07-09 (found while planning the breweries dataset — its spec's Open Question 2):
- **`wf_api.queue_workflow` has no permission gate at all** (`00000000010520_wf_fn.sql:2`): it is
  SECURITY DEFINER (house-pattern deviation — `_api` should be INVOKER + `jwt.enforce_permission`)
  and performs no `jwt.*` check before delegating; combined with
  `grant all on all routines in schema wf_api to anon, authenticated, service_role` it is open to
  every request.
- **`wf_fn.clone_wf_template` resolves templates globally** — its tenant filter is commented out
  (`-- tenant_id = _tenant_id`, `00000000010520_wf_fn.sql:~791`). Seeding a template for one
  tenant (e.g. anchor-only) does **not** restrict who can queue it: any authenticated user in any
  tenant can queue any template by identifier.
- Consequence for the breweries dataset (`.claude/specs/tenant-app/datasets/breweries/`): the
  `sync-breweries` template is meant to be `p:app-admin-super`-only (polite use of a volunteer-run
  upstream API), but until this issue is fixed the only gate is UI-side (the button is
  permission-hidden). **Deliberately deferred here** to be solved with wf permissions holistically.

## Implication

Any authenticated user — and, because of the grant-to-anon, **any unauthenticated GraphQL request**
(PostGraphile exposes `wf`/`wf_api` schemas in `apps/graphql-api-app/server/graphile.config.ts`) —
can read and write every tenant's workflow data: workflow instances, units of work, dependencies,
role assignments. This is a complete cross-tenant data exposure for the wf module and directly
violates global-rules R9 ("All tables have RLS enabled") and the security model in
`.claude/specs/graphql-api-pattern.md`.

## Suggested fix

One new sqitch change in `db/fnb-wf` (deploy + revert + verify), e.g. `<ts>_wf_rls`:

1. `alter table wf.<t> enable row level security` for all five tables.
2. Policies per the template in `.claude/specs/architecture-considerations/read-these/a3-rls-policy-reference.md`:
   - Tenant-scoped tables (`wf.wf`, `wf.uow`): `FOR ALL USING (jwt.has_permission('p:app-user', tenant_id))`
     (or a dedicated `p:wf` permission if the module should be separately licensed — decide with the user;
     the permission-key table in the implementor skill lists no `p:wf` today).
   - Reference tables (`wf.wf_type`): `FOR SELECT USING (true)` if genuinely public catalog data,
     mirroring `app.application`'s `1=1` SELECT-only pattern; otherwise tenant-scope them.
   - Add `manage_all_super_admin` policies (`jwt.has_permission('p:app-admin-super')`) mirroring app module.
3. Add FKs `wf.wf.tenant_id → app.tenant(id)` and `wf.uow.tenant_id → app.tenant(id)`
   (cross-package dependency on `fnb-app:00000000010220_app` in `sqitch.plan`).
4. Optional (decide with user): add `wf_tenant`/`wf_resident` shadow tables + `ensure_wf_resident`
   per the module pattern; the wf module currently deviates and may be intentionally system-driven
   (graphile-worker writes) rather than resident-driven.
5. Narrow the grants: reads for `authenticated` only (RLS filters rows); no table grants to `anon`
   unless a genuinely public surface exists.
6. **Template-level queue gating** (2026-07-09 addition): give `wf_api.queue_workflow` a real gate.
   Sketch from the breweries planning session — nullable `wf.wf.required_permission_key citext` on
   templates, enforced in `wf_api.queue_workflow` (`perform jwt.enforce_permission(<key>)` when
   set), seeds setting it per template (`sync-breweries` → `p:app-admin-super`); alternatively fold
   into whatever holistic permission model this issue lands on. Also decide whether
   `clone_wf_template`'s commented-out tenant filter should be restored (tenant-scoped templates)
   or template sharing is intentional. Convert `wf_api.*` to SECURITY INVOKER per the house pattern
   while here.

Note: graphile-worker task handlers write wf rows via `useFnbPgClient`
(`apps/graphql-api-app/server/lib/worker-task-handlers/`), which connects outside claims context —
verify they connect as a role that bypasses or satisfies the new policies (e.g. `service_role` grant
retained, or the pool role owns the tables) before enabling RLS, or the workers will break.

## Verification

- After the user redeploys: `select relname, relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where nspname='wf'` — all `true`.
- As `anon` (psql `set role anon` after connecting as authenticator): `select * from wf.wf` → permission denied / zero rows.
- With claims set for tenant A (`withClaims`-equivalent psql: `set local role authenticated; select set_config('request.jwt.claims', '<tenant-A payload>', true)`): only tenant A rows visible.
- Run a workflow end-to-end via the existing graphql-api-app workflow UI to confirm graphile-worker still functions (user restarts env; verification read-only).
