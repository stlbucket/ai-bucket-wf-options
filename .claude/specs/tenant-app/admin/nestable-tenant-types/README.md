# admin/nestable-tenant-types — Client & Organization node types

> **Execution Directive:** plan + build this spec via
> `/fnb-stack-implementor .claude/specs/tenant-app/admin/nestable-tenant-types/README.md` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
Implemented (2026-07-23) — DB + types + GraphQL client + tenant-app UI landed; `pnpm build`
green (13/13); env rebuilt + codegen run; DB deploy verified live (enum values, `chk_nested_parent`,
`tenant_spine_ids`, `set_nested_tenant_type`). Functional DB behavior spot-checked in a rolled-back
txn (spine scope = ancestors + self + subtree, sibling excluded; type-setter guards 22023/42501 +
admin gate; constraint blocks nested-type roots and parentless workspaces). UI walkthrough deferred
to the user's own testing. Built via plan
`.claude/issues/addressed/0105__app_______nestable-tenant-types___________MED__.plan.md`.

## Purpose

Today the nested-tenant subtree has exactly **one** node type — `workspace` — the only type the
`chk_workspace_parent` constraint permits to carry a `parent_tenant_id`. This spec adds two more
**interchangeable nested node types**, `client` and `organization`, so a nested tenant can be
relabeled (via a dropdown) to any of `{workspace, client, organization}` with **no behavioral
difference** in nesting, creation, or membership. Root tenant types (`anchor, customer, demo,
test, trial`) are untouched.

It also **narrows** the "Manage Residents" candidate pool. Previously the pool spanned the whole
tenant tree (root + every descendant). It now spans only the **vertical spine** through the
current node: its ancestor lineage up to and including the root tenant, **plus** the current
node's own subtree — excluding sibling branches.

### Model recap (source of truth: `db/fnb-app/deploy/00000000010220_app.sql`)
- `app.tenant_type` enum today: `anchor, customer, demo, test, trial, workspace`.
- A tenant carries a parent **iff** its type is `workspace` (`chk_workspace_parent`).
- `customer` is the default **root** type (`create_tenant`); `create_workspace` sets `workspace`.
- Claims already carry `tenantType` (`app_fn.profile_claims.tenant_type` → `ProfileClaims.tenantType`),
  added by the Manage-Residents spec (`../user/README.md`).

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| **New enum values** | Add `'client'` and `'organization'` to `app.tenant_type`. **Do not** reuse `customer`. | User choice (2026-07-23). `customer` stays the root default; the nested set is a distinct, unambiguous trio. |
| **Nestable set** | `{workspace, client, organization}` — interchangeable node types. | User choice. Behavior (nesting, creation, membership) is identical across the three; only the label differs. |
| **Nesting rule** | **Child-only.** Generalize `chk_workspace_parent` → `chk_nested_parent`: `(type in ('workspace','client','organization')) = (parent_tenant_id is not null)`. | User choice. `client`/`organization` are brand-new values (no existing rows), so child-only is safe — no migration. `workspace` was already child-only; the root types stay root-only. |
| **Pool scope** | **Spine** = ancestors + self + own subtree. `app_fn.workspace_resident_pool` walks up to the root **and** down through the current node's descendants; sibling branches excluded. | User choice. Replaces the old whole-tree (`tenant_tree_root` + `tenant_tree_ids(root)`) scope. |
| **Block cascade scope** | **Unchanged: whole-tree.** `app_fn.remove_profile_from_tree_workspaces` still removes a blocked person from **every** nested node in the org, only broadening its type filter to the nestable set. | The block cascade is a security guarantee ("deactivated ⇒ no access anywhere"), independent of the assignment pool. Narrowing it would leave access on sibling branches. |
| **Type editing — two paths** | (A) `site-admin/tenant/[id]` (`p:app-admin-super`, existing `update_tenant`) gets **context-aware** options: nested tenant → nestable trio, root tenant → root types. (B) `admin/workspace/[id]` (`p:app-admin`) gets a new type editor backed by a new `set_nested_tenant_type` mutation scoped to direct children. | User choice ("Both"). `update_tenant` is super-only; tenant admins need a `p:app-admin`-scoped path, and the direct-child scope matches the workspace detail page's existing reach. |
| **Button-gate broadening** | The Manage-Residents button gate `tenantType === 'WORKSPACE'` broadens to `tenantType ∈ {WORKSPACE, CLIENT, ORGANIZATION}`. | The pool + membership now serve all nestable types. |
| **Names retained** | Keep `workspace_resident_pool`, `app_api.workspace_resident_pool`, `workspaceResidentPool`, `WorkspaceResidentsModal`, and the `/tenant/admin/workspace` route as-is. | Minimize churn; they now cover the whole nestable set but the semantics are the same. Renames rejected below. |
| **DB delivery** | In-place edits to existing sqitch deploy files (+ revert/verify), rebuild-only env. | House rule; matches the workspace + Manage-Residents specs. |

## Files in this spec

| File | Covers |
|---|---|
| `README.md` | This index |
| `_shared.data.md` | Enum + constraint change, the spine helper + pool rewrite, the new `set_nested_tenant_type` fn pair, cascade type-filter broadening, `TenantType`, GraphQL ops, composable |
| `ui.md` | The three UI touch points: admin/user gate, site-admin/tenant dropdown, admin/workspace type editor |

**Sync pointers added to** (authoritative delta lives here):
- `../user/_shared.data.md` + `../user/README.md` (pool scope + gate)
- `../workspace/_shared.data.md` (constraint + `set_nested_tenant_type`)
- `../../site-admin/tenant/[id].data.md` (context-aware dropdown)

## Implementation Task List

### Phase 1 — DB (in-place edits, then env rebuild by the user)
- [x] `00000000010220_app.sql`: add `'client'`, `'organization'` to `app.tenant_type`; rename/generalize `chk_workspace_parent` → `chk_nested_parent`. Update **revert** + **verify** (`00000000010220_app.sql` under `revert/` + `verify/`).
- [x] `00000000010242_app_fn_definers.sql`: add `app_fn.tenant_spine_ids(_tenant_id)` (DEFINER); rewrite `app_fn.workspace_resident_pool` to scope on the spine (drop `tenant_tree_root`/`_root`); broaden the `type = 'workspace'` filter in `app_fn.remove_profile_from_tree_workspaces` to the nestable set.
- [x] `00000000010240_app_fn.sql`: add `app_fn.set_nested_tenant_type(_tenant_id, _type)` (DEFINER, validates nestable type + direct-child-of-`jwt.tenant_id()`) + `app_api.set_nested_tenant_type` (INVOKER, `p:app-admin` guard).
- [x] Ask the user to rebuild; verify read-only via a rolled-back claims-simulated txn (spine pool on a 3-level tree with a sibling branch → sibling residents absent, ancestors + own subtree present; set a child's type to `client`/`organization` as parent admin → succeeds; try a root type → constraint rejects; non-admin → 30000).

### Phase 2 — types + GraphQL client
- [x] `packages/fnb-types/src/tenant.ts`: `TenantType` union += `'CLIENT' | 'ORGANIZATION'`.
- [x] New op `setNestedTenantType.graphql` (mutation); codegen after rebuild.
- [x] Add a `setType`/`updateType` method to `useWorkspaces`/`useWorkspaceDetail` (real impl in `packages/graphql-client-api/src/composables/useWorkspaces.ts`); re-export unchanged.
- [x] Confirm `workspaceResidentPool` op is unchanged (only its server-side scope moved).

### Phase 3 — tenant-app UI
- [x] `pages/admin/user/index.vue`: broaden `isWorkspace` → `isNested` gate (`WORKSPACE|CLIENT|ORGANIZATION`).
- [x] `pages/site-admin/tenant/[id].vue`: make `typeOptions` context-aware on the tenant's nested-vs-root status (ensure the detail query selects `parentTenantId`).
- [x] `pages/admin/workspace/[id].vue`: add a nestable-type editor (USelect + Save) in the summary card, `p:app-admin`, calling the new composable method; toast + refresh on success.
- [x] `pnpm build` gate green.

### Phase 4 — spec upkeep
- [x] README status → Implemented; task boxes retro-checked; sync pointers confirmed in the three affected specs.

## Remaining Open Questions
- None blocking. (The whole-tree block cascade vs. spine pool asymmetry is a **deliberate** locked decision, not an open question — revisit only if a future requirement wants block to respect the spine.)

## Considered & rejected
- **Reuse `customer` as a nested type** — collides with its established root-default meaning and would force the child-only constraint onto existing root customer tenants. User chose distinct `client`/`organization`.
- **Renaming `workspace_resident_pool` / `WorkspaceResidentsModal` / the route** to a neutral "nested" vocabulary — churns the GraphQL op, composable, component, and nav for zero behavior change; the existing names remain accurate enough.
- **Narrowing the block cascade to the spine** — would leave a deactivated person with access on sibling branches; the cascade is a security guarantee, kept whole-tree.
- **Extending `update_tenant` (super-only) for the workspace-admin path** — would either widen a super-admin function's gate or duplicate its body; a purpose-built, direct-child-scoped `set_nested_tenant_type` is the house pattern (mirrors `deactivate_workspace`).
- **Type choice at create time** — user scoped this to editing only; creation still defaults to `workspace`.
