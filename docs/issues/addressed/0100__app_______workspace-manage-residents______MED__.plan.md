# Plan: Workspace "Manage Residents" + deactivation cascade

> **Execution Directive:** plan + build this via
> `/fnb-stack-implementor .claude/issues/identified/0100__app_______workspace-manage-residents______MED__.plan.md`
> — execute the phases below in order. Source spec:
> `.claude/specs/tenant-app/admin/user/README.md` (+ `_shared.data.md`, `index.{ui,data}.md`).
> Never run `git`. Never rebuild/restart the env — ask the user, then verify read-only.

**Severity: MED** (feature; DB enum + claims-contract change ripple, cross-tenant DEFINER logic) ·
Category: app · Identified: 2026-07-22

## Summary

On `/tenant/admin/user`, when the acting user is `p:app-admin` **and the current tenant is a
`workspace`**, add a **Manage Residents** button opening a modal with a checkbox list of every
person in the whole tenant tree (root ancestor + all workspace descendants). Check = add to this
workspace (guest resident + `app-user` license, dormant); uncheck = soft-remove (`status='removed'`).
Separately: blocking/deactivating a resident in the tenant soft-removes them from **all** workspaces
in the tree. Full contract + locked decisions in the spec README/`_shared.data.md`.

**Key constraint that shapes the design:** `idx_uq_resident ... where status='active'`
(`db/fnb-app/deploy/00000000010220_app.sql:292`) allows only one `'active'` residency per profile
platform-wide, so non-entered members sit at `'inactive'` (dormant, entered via `assume_residency`) —
which is why "removed" needs a **new `'removed'` enum value**, not `'inactive'`.

---

## Phase 1 — DB (in-place edits; then USER rebuilds, we verify read-only)

All edits are in-place to existing `db/fnb-app/deploy/*.sql` (rebuild-only env; house rule) with
matching **revert/verify** updates.

1. **`00000000010220_app.sql`** — add `'removed'` to `app.resident_status` enum (anchor: the
   `create type app.resident_status as enum (...)` at lines 39–47). Update
   `revert/00000000010220_app.sql` + `verify/00000000010220_app.sql`.

2. **`00000000010230_app_fn_types.sql`** —
   - Add `tenant_type app.tenant_type` to `app_fn.profile_claims` (anchor: composite at line 22,
     insert after `tenant_name`, before `modules`).
   - Add new composite `app_fn.workspace_resident_candidate` (fields per `_shared.data.md`).
   - Update revert/verify.

3. **`00000000010240_app_fn.sql`** —
   - `app_fn.current_profile_claims(_profile_id uuid)` (anchor line 471): populate the new
     `tenant_type` slot from `app.tenant` for `_tenant_id`.
   - `app_fn.block_resident(_resident_id uuid)` (anchor line 1083): after the
     `update ... set status='blocked_individual' ... returning * into _resident;` (line 1092),
     add `if _resident.profile_id is not null then perform
     app_fn.remove_profile_from_tree_workspaces(_resident.profile_id, _resident.tenant_id); end if;`
   - Verify **every** other `app_fn.profile_claims` constructor sets `tenant_type` — grep the repo
     for `profile_claims` assignments; confirm `app_fn.profile_claims_for_user`
     (`00000000010260_app_bootstrap.sql`) is updated so the db-access raw-pg path agrees.

4. **`00000000010242_app_fn_definers.sql`** (home of `invite_user`/`assume_residency` — DEFINER
   cross-tenant fns) — add, per `_shared.data.md`:
   - `app_fn.tenant_tree_root(_tenant_id uuid) returns uuid` — DEFINER STABLE (walk up)
   - `app_fn.tenant_tree_ids(_root_id uuid) returns setof uuid` — DEFINER STABLE (walk down)
   - `app_fn.workspace_resident_pool(_workspace_tenant_id uuid) returns setof
     app_fn.workspace_resident_candidate` — DEFINER STABLE
   - `app_fn.set_workspace_membership(_workspace_tenant_id uuid, _profile_id uuid, _member boolean,
     _actor_profile_id uuid) returns app.resident` — DEFINER (reuses `app_fn.invite_user(..., 'user')`;
     self-remove raises `31010`; pool-membership + workspace guards raise `30000`)
   - `app_fn.remove_profile_from_tree_workspaces(_profile_id uuid, _from_tenant_id uuid) returns void`
     — DEFINER (the block cascade)
   - `app_api.workspace_resident_pool()` + `app_api.set_workspace_membership(_profile_id uuid,
     _member boolean)` — INVOKER, `perform jwt.enforce_permission('p:app-admin')`, delegate with
     `jwt.tenant_id()` / `jwt.profile_id()`
   - Update revert/verify for the change.

   **No new RLS policy** — cross-tree reach is all inside DEFINER `app_fn`; the mutation's returned
   resident row is in the caller's own tenant (readable via existing `view_all_for_tenant` /
   `manage_own_tenant_residencies`, `00000000010250_app_policies.sql:53,59`).

5. **STOP → ask the user to rebuild** (`docker compose down && docker compose up` /
   `pnpm env-rebuild`). Then **read-only verification** via a rolled-back claims-simulated
   transaction over a 3-tenant tree (root → workspace A → workspace B):
   - pool from A lists people across root+A+B, `isMember` correct, self checked, support/profile-less excluded
   - add → dormant `'inactive'` guest + `app-user` license
   - remove → `'removed'` + workspace licenses `'inactive'`; re-add reactivates
   - self-remove raises `31010`; non-admin claims raise `30000`
   - `block_resident` on a tree member → `'removed'` in all tree workspaces + licenses inactive;
     `unblock_resident` restores tenant residency but leaves workspace memberships `'removed'`
   - `current_profile_claims` now carries `tenant_type`

## Phase 2 — types + GraphQL client (`packages/`)

6. **`fnb-types`** — add `tenantType: TenantType | null` to `ProfileClaims`
   (`packages/fnb-types/src/profile-claims.ts`; import `TenantType` from `./tenant`). No barrel change
   (same file). 

7. **Claims paths carry `tenantType`:**
   - GraphQL: add `tenantType` to the `current_profile_claims` selection used by `fetchProfileClaims`
     (`packages/graphql-client-api/src/composables/useProfileClaims.ts` + its `.graphql` doc) and the
     mapper that builds `ProfileClaims`.
   - db-access raw-pg: `packages/db-access/src/utils/normalize-claims.ts` — pass `tenantType` through
     (uppercase if it arrives lowercase, mirroring `profileStatus`).

8. **New GraphQL ops** under `packages/graphql-client-api/src/graphql/app/`:
   - `query/workspaceResidentPool.graphql` → `workspaceResidentPoolList { profileId email
     displayName fullName homeTenantName workspaceResidentId isMember }`
   - `mutation/setWorkspaceMembership.graphql` → `setWorkspaceMembership(input: { profileId, member })
     { resident { ...Resident } }` (reuse `app/fragment/Resident.graphql`)
   - **Verify PostGraphile field/arg names** against `src/generated/fnb-graphql-api.ts` / GraphiQL
     after the rebuild before finalizing (inflection of `_profile_id`→`profileId`, `_member`→`member`,
     the setof-fn list field name). Add a `postgraphile.tags.json5` nudge only if needed.

9. **Codegen** — `pnpm -F @function-bucket/fnb-graphql-client-api generate`.

10. **Composable** `packages/graphql-client-api/src/composables/useWorkspaceResidents.ts`:
    `{ candidates, fetching, error, executeQuery, setMembership(profileId, member) }`; declares the
    `WorkspaceResidentCandidate` view type (R4). Re-query the pool network-only after each toggle.
    **Also** expose `executeQuery` from `useAdminResidents` (currently returns `{ data, fetching,
    error }` only) so the page can refresh the list.

11. **Barrel** — add `export * from './composables/useWorkspaceResidents'` to
    `packages/graphql-client-api/src/index.ts` (the #1 miss — runtime ESM crash if omitted). Build:
    `pnpm -F @function-bucket/fnb-graphql-client-api build`.

## Phase 3 — tenant-app UI (`apps/tenant-app/`)

12. Re-export `apps/tenant-app/app/composables/useWorkspaceResidents.ts` (single line).

13. **`WorkspaceResidentsModal.vue`** (`apps/tenant-app/app/components/`) — self-contained, mirrors
    `WorkspaceCreateModal.vue` (owns `open`, renders its own `UButton` trigger "Manage Residents",
    `i-lucide-users-round`; emits `changed`). `UModal` body = scrollable candidate list, each row a
    `UCheckbox` + name + email + `home_tenant_name` badge; acting admin's row checked+disabled
    (`profileId === claims.profileId`); per-row pending; `useToast` on success/error (UC7); `UEmpty`
    if pool empty (UC8). Verify `i-lucide-users-round` exists (UC11).

14. **`apps/tenant-app/app/pages/admin/user/index.vue`** — in `PageHeader #actions`, render
    `<WorkspaceResidentsModal>` when `canInvite && user.tenantType === 'WORKSPACE'` (claims via
    `useAuth()`); on its `changed` emit call `useAdminResidents().executeQuery({ requestPolicy:
    'network-only' })` to refresh the visible list.

15. **`pnpm build`** gate green (the repo gate; repo-wide `pnpm lint` is known-broken).

## Phase 4 — spec upkeep

16. Flip spec statuses to Implemented, retro-check the README task list, and record any in-flight
    corrections (code is the source of truth). Ask the user before moving this plan to `addressed/`.

---

## Verification (end-to-end, read-only)

- As a **workspace admin**: Manage Residents button appears; modal lists the tree pool; checking a
  person adds them (they appear in the workspace's resident list after refresh) with an `app-user`
  license; unchecking removes them; own row is checked+disabled.
- As a **non-workspace (root/customer) admin**: button does **not** appear (`tenantType !== 'WORKSPACE'`).
- Blocking a member on the user detail page removes them from every workspace in the tree.
- Network tab: `POST /graphql-api/api/graphql` with `WorkspaceResidentPool` / `SetWorkspaceMembership`
  (no REST, no GET). No console ESM/barrel errors.

## Risks / notes

- **Claims-contract ripple** (`tenant_type` on `app_fn.profile_claims`) touches every constructor +
  both claim paths + fnb-types + the claims `.graphql`/mapper — enumerated in Phase 1.3 / 2.6–2.7;
  a missed constructor is a hard SQL error at rebuild, caught in Phase 1 verification.
- **Removing a currently-entered member** flips them to `'removed'`; their live claims keep the
  stale residency until next `refreshClaims` — same as the existing block flow, acceptable.
- **PostGraphile inflection** of the setof-fn list field + mutation input keys is confirmed against
  the generated schema in Phase 2.8 before the composable/ops are finalized.
