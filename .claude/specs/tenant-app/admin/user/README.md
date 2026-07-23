# admin/user — Residents + Workspace "Manage Residents"

> **Execution Directive:** plan + build this spec via
> `/fnb-stack-implementor .claude/specs/tenant-app/admin/user/README.md` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
Implemented (2026-07-22) — DB + types + GraphQL client + tenant-app UI landed; `pnpm build`
green (13/13); env rebuilt + codegen run; DB deploy verified (enum/type/claim/functions live).
Functional DB spot-check + UI walkthrough deferred to the user's own testing. Built via plan
`.claude/issues/in-flight/0100__app_______workspace-manage-residents______MED__.plan.md`.

## Purpose

The `/tenant/admin/user` page lists the current tenant's residents (implemented). This spec
**adds** a workspace-only membership manager.

When the acting user is an **admin** (`p:app-admin`) **and the current tenant is a `workspace`**,
the page shows a **Manage Residents** button next to *Invite User*. It opens a modal with a
checkbox list of every person in the **whole tenant tree** — the top-level (root) ancestor
tenant plus **all** of its workspace descendants. Checking a person adds them to *this*
workspace (guest residency + `app-user` license); unchecking soft-removes them. This lets a
workspace admin compose the workspace's roster from people who already exist anywhere in the
organization, without re-inviting by email.

The current tenant is a workspace iff `app.tenant.parent_tenant_id is not null` (`chk_workspace_parent`,
`db/fnb-app/deploy/00000000010220_app.sql`). See the workspace-tenant model in
`../workspace/README.md`.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| **Pool scope** | Entire tree: walk up `parent_tenant_id` to the root, then every person holding a resident anywhere in the root + **all** its workspace descendants (both recursive). | User choice. The whole organization is the candidate pool, not just one level. |
| **Membership marker** | `app.resident` row per (profile, workspace). "Member" = a row exists whose status is **not** `'removed'`. New members are created **dormant** (`status = 'inactive'`) + an `app-user` license, exactly like the workspace creator (`app_fn.create_workspace`), and are entered via the existing `assume_residency` switcher. | The partial unique index `idx_uq_resident ... where status = 'active'` allows only **one** `'active'` residency per profile platform-wide, so a not-currently-entered member must sit at `'inactive'`. That makes `'inactive'` a legitimate *member* state — it cannot double as the removed marker. |
| **Remove = soft** | Uncheck → `status = 'removed'` (new enum value) + the workspace licenses go `'inactive'`. Re-check → back to `'inactive'` + licenses reactivated (or a fresh `invite_user` if no row exists). | User chose soft/reversible. A dedicated `'removed'` value is unambiguous vs. the dormant-member `'inactive'` state above; re-adding is a status flip, not a new row (`uq_resident (tenant_id, profile_id, type)` is reused). |
| **Add grants** | `app_fn.invite_user(workspace, email, 'user')` — guest resident + the workspace pack's `app-user` license. | User choice; reuses the existing license-granting machinery. |
| **Self + pending guard** | Pool lists only people with a real `app.profile` (pending, profile-less invites are skipped) and excludes `type = 'support'` residents. The acting admin's own row renders **checked + disabled**; the mutation also raises `31010` if you try to remove yourself. | User choice — an admin cannot accidentally evict themselves; a person must exist before they can be a member. |
| **Deactivation cascade** | When a resident is **blocked/deactivated in the tenant** (`app_fn.block_resident` → `blocked_individual`), they are soft-`removed` from **every workspace** in that tenant's tree (all `type='workspace'` descendants of the tree root) + their workspace licenses go `inactive`. **Unblock does not restore** workspace memberships — they are re-added manually via Manage Residents. | User requirement (2026-07-22). A deactivated person must not retain workspace access anywhere in the org; re-granting is deliberate, not automatic. |
| **Cross-tree reach** | New `SECURITY DEFINER` `app_fn` functions (pool + membership), guarded in their `app_api` wrappers by `p:app-admin`. **No new RLS policies.** | RLS exposes only *direct* children (`view_child_workspace_*`); reading/writing across a whole tree (incl. ancestors) is exactly the trusted cross-tenant case `SECURITY DEFINER` exists for (`invite_user` precedent). |
| **Button gating input** | Add `tenant_type` to the claims (`app_fn.profile_claims` → `ProfileClaims.tenantType`) so the button gates **synchronously** off `useAuth()` claims (already carries `tenantId`/`tenantName`). | Zero extra round-trip; reusable for future workspace-only UI. Alternative (a `current_tenant` query) rejected below. |
| **DB delivery** | In-place edits to existing sqitch deploy files (rebuild-only env; house rule). | Matches the workspace spec's delivery. |

## Files in this spec

| File | Covers |
|---|---|
| `README.md` | This index |
| `_shared.data.md` | Enum + claims + composite-type changes, the pool/membership functions, permission model, GraphQL ops, composable, view types |
| `index.ui.md` | User list page — **updated**: Manage Residents button + `WorkspaceResidentsModal.vue` |
| `index.data.md` | User list page — **updated**: pool query, membership mutation, composable, refresh-on-change |
| `[id].ui.md` / `[id].data.md` | User detail page (unchanged — implemented) |

## Implementation Task List

### Phase 1 — DB (in-place edits, then env rebuild by the user)
- [x] `00000000010220_app.sql`: add `'removed'` to `app.resident_status` enum (+ revert/verify)
- [x] `00000000010230_app_fn_types.sql`: add `tenant_type app.tenant_type` to `app_fn.profile_claims`; add composite `app_fn.workspace_resident_candidate`
- [x] `00000000010240_app_fn.sql`: populate `tenant_type` in `app_fn.current_profile_claims` (and any other `profile_claims` constructor — see `_shared.data.md`)
- [x] `00000000010242_app_fn_definers.sql`: `app_fn.tenant_tree_root`, `app_fn.tenant_tree_ids`, `app_fn.workspace_resident_pool` (DEFINER) + `app_fn.set_workspace_membership` (DEFINER); `app_api.workspace_resident_pool` + `app_api.set_workspace_membership` (INVOKER, `p:app-admin` guard); `app_fn.remove_profile_from_tree_workspaces` (DEFINER)
- [x] `00000000010240_app_fn.sql`: call `app_fn.remove_profile_from_tree_workspaces(_resident.profile_id, _resident.tenant_id)` from `app_fn.block_resident` (deactivation cascade)
- [x] Ask the user to rebuild; verify read-only via a rolled-back claims-simulated transaction (pool across a 3-tenant tree → add → dormant guest + app-user license → remove → `'removed'` + inactive licenses → re-add reactivates → self-remove raises 31010 → non-admin raises 30000 → **block a member in the tenant → they go `'removed'` in all tree workspaces + licenses inactive; unblock does not restore memberships**)

### Phase 2 — types + GraphQL client
- [x] `fnb-types`: `tenantType: TenantType \| null` on `ProfileClaims` (`packages/fnb-types/src/profile-claims.ts`)
- [x] Claims GraphQL path: add `tenantType` to the `current_profile_claims` selection + `normalizeClaims`/mapper (db-access raw-pg path too — see `_shared.data.md`)
- [x] New ops: `workspaceResidentPool.graphql` (query), `setWorkspaceMembership.graphql` (mutation)
- [x] Codegen; `useWorkspaceResidents.ts` composable + barrel export (`packages/graphql-client-api/src/index.ts`)
- [x] Expose `executeQuery` from `useAdminResidents` (so the page can refresh the list after edits)

### Phase 3 — tenant-app UI
- [x] Re-export `apps/tenant-app/app/composables/useWorkspaceResidents.ts`
- [x] `WorkspaceResidentsModal.vue` (self-contained: owns `open`, renders its trigger button)
- [x] `pages/admin/user/index.vue`: render the modal in `PageHeader #actions` when `canInvite && claims.tenantType === 'WORKSPACE'`; refresh the resident list on the modal's `changed` emit
- [x] `pnpm build` gate green

### Phase 4 — spec upkeep
- [x] README status → Implemented; task boxes retro-checked; record any in-flight corrections

## Implementation notes (2026-07-22 — code is source of truth)
- Only `app_fn.current_profile_claims` builds `app_fn.profile_claims` (field-by-field assignment, so
  the new `tenant_type` slot needed one line, not a positional-ROW rewrite); `profile_claims_for_user`
  delegates to it. `normalizeClaims` (db-access) uppercases the raw-pg `tenant_type`.
- `useWorkspaceResidents(pause?)` takes an optional `pause` ref so the always-mounted modal holds the
  pool query until opened.
- The modal checkbox is disabled for the acting admin's own row and while a per-row toggle is in
  flight; `31010`/`30000` map to friendly toasts.
- **Verified:** `pnpm build` 13/13; codegen matched the live schema; DB deploy live
  (enum/type/claim/functions). **Not yet exercised at runtime:** functional DB behavior
  (pool/add/remove/self-remove/block-cascade) and the UI walkthrough — left to the user's testing.

## Remaining Open Questions
- None blocking.

## Considered & rejected
- **`'inactive'` as the removed marker** — collides with the dormant-but-valid member state the one-active-residency constraint forces on all non-entered members.
- **Hard delete on remove** — the user chose soft/reversible; hard delete also risks FK references (support tickets, res registry) on real people.
- **A `current_tenant` query to gate the button** — works via the existing `view_own_tenant_user` self-select policy, but adds an async round-trip and button flicker; claims already carry tenant context, so `tenantType` belongs there.
- **New RLS policies for whole-tree reach** — SELECT policies would have to walk ancestors *and* arbitrary-depth descendants of the active tenant; the trusted `SECURITY DEFINER` `app_fn` path is the established house style for cross-tenant operations (`invite_user`).
- **A single "toggle" that flips `active`↔absent** — impossible under the one-active-residency unique index.
