# Plan: Nestable tenant types (client + organization) + spine-scoped resident pool

> **Execution Directive:** plan + build this via
> `/fnb-stack-implementor .claude/issues/identified/0105__app_______nestable-tenant-types___________MED__.plan.md`
> — execute the phases below in order. Source spec:
> `.claude/specs/tenant-app/admin/nestable-tenant-types/README.md`
> (+ `_shared.data.md`, `ui.md`). Never run `git`. Never rebuild/restart the env —
> ask the user, then verify read-only.

**Severity: MED** (feature; DB enum + check-constraint change, pool-scope rewrite, new
`p:app-admin` DEFINER mutation, claims-gate broadening) · Category: app · Identified: 2026-07-23

## Summary

Add two **interchangeable nested node types**, `client` and `organization`, alongside the existing
`workspace`. A nested tenant can be relabeled among `{workspace, client, organization}` via a
dropdown when editing — **no** behavioral difference in nesting, creation, or membership. Root
types (`anchor, customer, demo, test, trial`) untouched.

Also **narrow** the Manage-Residents candidate pool from whole-tree to the **spine** through the
current node: its ancestor lineage up to and including the root, **plus** the current node's own
subtree — excluding sibling branches. The block/deactivation cascade stays whole-tree (security
guarantee); only its type filter broadens.

Full contract + locked decisions in the spec README / `_shared.data.md` / `ui.md`.

**Design-shaping facts (verified anchors):**
- `app.tenant_type` enum: `db/fnb-app/deploy/00000000010220_app.sql:7`.
- `chk_workspace_parent` (only `workspace` carries a parent): same file, `:153`.
- `customer` is the root default (`type ... default 'customer'`, `:149`) — **not** reused; `client`
  and `organization` are brand-new values, so child-only is safe with zero migration.
- Pool + cascade live in `00000000010242_app_fn_definers.sql`: `tenant_tree_root` `:406`,
  `tenant_tree_ids` `:422`, `workspace_resident_pool` `:437`, `remove_profile_from_tree_workspaces`
  `:490`.
- `update_tenant` (super-only, sets `type`): `00000000010240_app_fn.sql:1470`.
- Claims already carry `tenantType` (`ProfileClaims.tenantType`) — from the manage-residents work.
- The `Tenant` GraphQL fragment already selects `type` **and** `parentTenantId`, so both edit pages
  (`appTenantById` / `workspaceById` via `...Tenant`) need **no query change**.

---

## Phase 1 — DB (in-place edits; then USER rebuilds, we verify read-only)

All edits in-place to existing `db/fnb-app/deploy/*.sql` (rebuild-only env; house rule) with
matching **revert/verify** updates.

1. **`00000000010220_app.sql`** —
   - `app.tenant_type` enum (`:7`): add `'client'` and `'organization'` (alphabetical placement:
     after `anchor` and after `demo` respectively).
   - Rename/generalize the check constraint (`:153`)
     `chk_workspace_parent` → `chk_nested_parent`:
     `check ((type in ('workspace','client','organization')) = (parent_tenant_id is not null))`.
   - Update `revert/00000000010220_app.sql` + `verify/00000000010220_app.sql` (the constraint
     existence check → new name; enum-value checks if present).

2. **`00000000010242_app_fn_definers.sql`** —
   - **Add** `app_fn.tenant_spine_ids(_tenant_id uuid) returns setof uuid` — DEFINER STABLE:
     recursive `up` (self + ancestors) `union` recursive `down` (self + descendants). Body in
     `_shared.data.md` → "Spine helper".
   - **Rewrite** `app_fn.workspace_resident_pool` (`:437`): drop the `_root` variable and the
     `tenant_tree_root`/`tenant_tree_ids(_root)` calls; change the candidate `where` to
     `r.tenant_id in (select app_fn.tenant_spine_ids(_workspace_tenant_id))`. Profile join +
     membership annotation **unchanged**. `app_api.workspace_resident_pool` unchanged.
   - **Broaden** the type filter in `app_fn.remove_profile_from_tree_workspaces` (`:490`), **both**
     the resident soft-remove and the license-inactivate branches:
     `where type in ('workspace','client','organization')` (was `type = 'workspace'`). Keep the
     whole-tree scope (`_root := tenant_tree_root(...)`, `tenant_tree_ids(_root)`).
   - `tenant_tree_root` / `tenant_tree_ids` stay (still used by the cascade).
   - Mirror the existing `EXECUTE`-grant pattern for any new `app_api` fn added below (see step 3).

3. **`00000000010240_app_fn.sql`** — add near `update_tenant` (`:1470`):
   - `app_fn.set_nested_tenant_type(_tenant_id uuid, _type app.tenant_type) returns app.tenant` —
     DEFINER VOLATILE. Guard: `_type in ('workspace','client','organization')` else raise `22023`;
     `update app.tenant set type=_type, updated_at=now() where id=_tenant_id and
     parent_tenant_id = jwt.tenant_id() returning * into _tenant`; null → raise `42501`
     (not a direct child). Body in `_shared.data.md` → "New — nested tenant type editor".
   - `app_api.set_nested_tenant_type(_tenant_id, _type)` — INVOKER; `perform
     jwt.enforce_permission('p:app-admin')` then delegate.
   - Add the `grant execute on function app_api.set_nested_tenant_type(...) to authenticated;` line
     wherever the sibling `app_api` grants live (grep for `grant execute on function
     app_api.workspace_resident_pool`).

4. **Ask the user to rebuild.** Then verify **read-only** via a rolled-back claims-simulated txn:
   - Build a 3-level tree with a **sibling branch**; call `app_fn.workspace_resident_pool` for a
     mid node → sibling-branch residents **absent**; ancestors + own-subtree residents **present**.
   - As a parent admin, `app_api.set_nested_tenant_type(child, 'client')` and `'organization'` →
     succeed; a root type (e.g. `'customer'`) → raises `22023`; a non-child id → `42501`;
     non-`p:app-admin` → `30000`.
   - Confirm `chk_nested_parent` rejects giving a root tenant a nested type (no parent) and rejects
     removing the parent from a nested tenant.

---

## Phase 2 — types + GraphQL client

5. **`packages/fnb-types/src/tenant.ts:6`** — `TenantType` union += `'CLIENT' | 'ORGANIZATION'`
   (keep alphabetical). No `ProfileClaims` shape change.

6. **New op** `packages/graphql-client-api/src/graphql/app/mutation/setNestedTenantType.graphql` —
   `mutation SetNestedTenantType($tenantId: UUID!, $type: TenantType!)` →
   `setNestedTenantType(input: { ... }) { tenant { ...Tenant } }`. Confirm the exact PostGraphile
   field/input inflection against the live schema post-rebuild (mirror `updateTenant.graphql`'s
   `_input` shape — the fn takes two scalar args, so the input wrapper differs; check GraphiQL).

7. **Codegen:** `pnpm -F @function-bucket/fnb-graphql-client-api generate` (after the user's
   rebuild — the enum values + new mutation must be in the live schema first).

8. **`packages/graphql-client-api/src/composables/useWorkspaces.ts`** — in `useWorkspaceDetail`
   (`:91`), add `const { executeMutation: execSetType } = useSetNestedTenantTypeMutation()` and a
   `setNestedType(tenantId, type)` method (throw on `res.error`, then `executeQuery({ requestPolicy:
   'network-only' })`); return it. Barrel already exports the composable — no `src/index.ts` change
   (verify).

9. Confirm `workspaceResidentPool.graphql` is **unchanged** (scope moved server-side only).

## Phase 3 — tenant-app UI (per `ui.md`)

10. **`apps/tenant-app/app/pages/admin/user/index.vue:12`** — replace `isWorkspace` with
    `isNested` = `['WORKSPACE','CLIENT','ORGANIZATION'].includes(user.value?.tenantType ?? '')`;
    `<WorkspaceResidentsModal v-if="isNested" ...>`.

11. **`apps/tenant-app/app/pages/site-admin/tenant/[id].vue:77`** — make `typeOptions` a `computed`
    keyed on `tenant.value?.parentTenantId != null`: nested → `['workspace','client',
    'organization']`, root → `['anchor','customer','demo','test','trial']`. (Fragment already
    provides `parentTenantId` — no query change.)

12. **`apps/tenant-app/app/pages/admin/workspace/[id].vue`** — add a nestable-type editor (USelect +
    Save) in the summary `UCard`, gated `p:app-admin`; init from `workspace.type` (already selected
    via `...Tenant`); call `setNestedType(workspace.id, typeForm.toUpperCase())`; toast + the
    composable's network-only refresh on success. Snippet in `ui.md` §3.

13. **`pnpm build`** gate green (13/13). Fix any barrel/import fallout.

## Phase 4 — spec upkeep

14. README status → Implemented (date, build result, what was/wasn't runtime-verified); retro-check
    the task boxes. Confirm the three sync-pointer notes are present (already added:
    `../user/_shared.data.md`, `../workspace/_shared.data.md`,
    `../../site-admin/tenant/[id].data.md`).
15. **Completion hand-off:** ask the user (yes/no) whether to move this plan to
    `.claude/issues/addressed/` — never auto-file.

---

## Out of scope / deliberate
- **Block cascade stays whole-tree** — only its type filter broadens (locked decision; narrowing it
  would leave a deactivated person with access on sibling branches).
- **No rename** of `workspace_resident_pool` / `WorkspaceResidentsModal` / the `/tenant/admin/workspace`
  route — churn for zero behavior change.
- **No type choice at create time** — creation still defaults to `workspace`; editing only.

## Rollback / risk notes
- Enum values are additive; the constraint rename is the only potentially-breaking DDL — verify no
  existing tenant violates `chk_nested_parent` (impossible: `client`/`organization` are new, and
  `workspace` was already child-only).
- Codegen must run **after** the user rebuilds (live schema needs the new enum members + mutation),
  else the generated `TenantType`/hook will lag.
