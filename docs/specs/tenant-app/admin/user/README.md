# admin/user — Residents + Workspace "Manage Residents" + Subtree Roll-up

> **Execution Directive:** plan + build this spec via
> `/fnb-stack-implementor docs/specs/tenant-app/admin/user/README.md` —
> the implementor derives the `docs/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
Implemented (2026-07-22) — DB + types + GraphQL client + tenant-app UI landed; `pnpm build`
green (13/13); env rebuilt + codegen run; DB deploy verified (enum/type/claim/functions live).
Functional DB spot-check + UI walkthrough deferred to the user's own testing. Built via plan
`docs/issues/in-flight/0100__app_______workspace-manage-residents______MED__.plan.md`.

**Extension (2026-07-27) — child-tree roll-up: Implemented.** The list page rolls up the
residents of the current tenant **plus its entire child subtree** into a single, one-row-per-person
list; child-tenant people get a **read-only** detail view. Contract in `_shared.data.md` →
"Subtree Roll-up". Built via plan
`docs/issues/in-flight/0155__app_______admin-user-subtree-rollup_______MED__.plan.md`:
DB deployed + functionally verified in a rolled-back claims txn (scoping, 30000 guards);
`pnpm build` 13/13 green; UI walkthrough deferred to the user's own testing.
In-flight corrections: `app.resident.email` is `text` → the list fn casts it `::citext`;
`ResidentList.vue` had no remaining consumers and was deleted.

**Legend tweak (2026-08-04) — spec updated, not yet built.** `Inactive` becomes its **own blue
(`info`) legend category**, split from the old combined `Declined / Inactive` neutral entry. The
change lives in the shared resident color map (`packages/auth-layer/app/utils/status.ts`), so
inactive residents render blue in every resident badge — see Phase 9 + `index.ui.md`.

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

**Subtree roll-up (2026-07-27).** `/tenant/admin/user` no longer lists only the current tenant's
residents: it rolls up every resident of the current tenant **and all of its descendant tenants**
(the child subtree — *not* ancestors, *not* siblings) into one list, deduplicated to **one row per
person**, with per-tenant membership shown as badges. Clicking a person who holds a residency in
the current tenant opens the existing management detail; clicking a person who exists **only** in
child tenants opens the same route in a **read-only** mode (no block/license actions — those are
managed from inside the owning tenant). Both admins (`p:app-admin`) and super admins use this page:
a super admin is either an admin of the anchor tenant (their home residency carries `p:app-admin`)
or enters a tenant via support mode.

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

### Locked decisions — subtree roll-up (2026-07-27)

| Decision | Choice | Why |
|---|---|---|
| **Roll-up scope** | Current tenant + **all descendants** (`app_fn.tenant_tree_ids(jwt.tenant_id())` — the existing helper already computes a subtree from any node). No ancestors, no siblings — this is the *child tree*, deliberately different from the Manage-Residents *spine* pool. | User directive 2026-07-27: "roll up all child-tree tenant users". An admin oversees what is *below* them. |
| **Row shape** | **One row per person** — deduplicate by `profile_id`; per-tenant memberships render as badges on the row. Pending invites (no profile yet) can't dedupe and stay as their own rows. | User choice 2026-07-27. |
| **DB returns flat rows; client groups** | `app_fn.tenant_subtree_residents` returns one row per residency (`app_fn.subtree_resident_row`); the composable groups them into the per-person view type (R4). | Flat `setof composite` is PostGraphile-friendly; grouping is presentation logic and belongs in the composable, keeping the DB fn reusable. |
| **Child-resident detail** | **Read-only.** Detail loads cross-tenant via a new `SECURITY DEFINER` JSON read (`subtreeResidentDetail`, mirroring the `siteUserById` jsonb precedent); block/unblock + license actions render only for current-tenant residents. | User choice 2026-07-27 — management stays inside the owning tenant. |
| **Permission gate** | `p:app-admin` only — no super-admin carve-out in the new functions. | User answer 2026-07-27: the super admin is also an admin of the **anchor tenant** (so holds `p:app-admin` there), and otherwise reaches any tenant via support mode. No new plumbing. |
| **`removed` rows excluded** | The roll-up (list + detail residencies) filters out `status = 'removed'` residencies everywhere. | They are ex-members (soft-removed from a roster); showing them as tenancy badges would misread as membership. Re-adding is Manage Residents' job. |
| **`support` rows excluded** | `type = 'support'` residencies never appear. | Same rule as the Manage-Residents pool; support staff are hidden from tenant views. |
| **Cross-tree reach** | New `SECURITY DEFINER` `app_fn` functions + `SECURITY INVOKER` `app_api` wrappers with the `p:app-admin` guard. **No new RLS policies.** | Same rationale as Manage Residents: RLS exposes only direct children (`view_child_workspace_*`); arbitrary-depth reads are the trusted-DEFINER case. |

## Files in this spec

| File | Covers |
|---|---|
| `README.md` | This index |
| `_shared.data.md` | Enum + claims + composite-type changes, the pool/membership functions, permission model, GraphQL ops, composable, view types; **+ the Subtree roll-up contract (2026-07-27)** |
| `index.ui.md` | User list page — Manage Residents button + `WorkspaceResidentsModal.vue`; **+ roll-up list (`SubtreeResidentList.vue`, one row per person)** |
| `index.data.md` | User list page — pool query, membership mutation, composable, refresh-on-change; **+ `TenantSubtreeResidents` query and grouping composable** |
| `[id].ui.md` / `[id].data.md` | User detail page — **updated 2026-07-27**: read-only fallback for child-tenant residents |

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

### Phase 5 — Subtree roll-up: DB (in-place edits, then env rebuild by the user)
- [x] `00000000010230_app_fn_types.sql`: add composite `app_fn.subtree_resident_row` (see `_shared.data.md`)
- [x] `00000000010242_app_fn_definers.sql`: `app_fn.tenant_subtree_residents(_tenant_id)` (DEFINER, STABLE) + `app_api.tenant_subtree_residents()` (INVOKER, `p:app-admin` guard); `app_fn.subtree_resident_detail(_tenant_id, _resident_id)` (DEFINER, STABLE, jsonb) + `app_api.subtree_resident_detail(_resident_id)` (INVOKER, `p:app-admin` guard)
- [x] Update the change's revert/verify files for the new type + functions
- [x] Ask the user to rebuild; verify read-only via a rolled-back claims-simulated txn (3-level tree: parent admin sees self + both child levels, one row per residency, no `support`/`removed` rows; sibling-branch and ancestor residents absent; detail on a grandchild resident returns profile + subtree residencies + licenses; detail on an out-of-subtree resident raises 30000; non-admin raises 30000)

### Phase 6 — Subtree roll-up: types + GraphQL client
- [x] New ops: `tenantSubtreeResidents.graphql` (query), `subtreeResidentDetail.graphql` (query); codegen after rebuild
- [x] `useAdminResidents.ts`: add `useSubtreeResidents()` (groups flat rows → `SubtreeUserView[]`, R4) and `useSubtreeResidentDetail(id, pause?)`; barrel + re-export
- [x] Retire the page's use of `TenantResidents` (op kept — `WorkspaceResidentsModal` refresh path reviews whether it still needs it; delete the op only if unused)

### Phase 7 — Subtree roll-up: tenant-app UI
- [x] `SubtreeResidentList.vue` (one row per person: name link, email, current-tenant status, tenancy badges)
- [x] `pages/admin/user/index.vue`: swap `ResidentList` → `SubtreeResidentList`, subtitle → people count; Invite/Manage-Residents gating unchanged
- [x] `pages/admin/user/[id].vue`: read-only fallback when `ResidentById` returns null (RLS miss) — render via `SubtreeResidentDetail`, hide all mutation actions
- [x] `pnpm build` gate green

### Phase 8 — spec upkeep
- [x] README status → Implemented for the roll-up extension; boxes checked; corrections recorded

### Phase 9 — legend: `Inactive` is its own blue category (2026-08-04)
- [ ] `packages/auth-layer/app/utils/status.ts`: in the `resident` map, change `inactive` from
  `neutral` → `info` (blue). Leave `declined` at `neutral`. (StatusColor already includes `info`.)
- [ ] `pages/admin/user/index.vue`: split the legend `Active / Supporting`, `Invited`, `Blocked`,
  `Declined / Inactive` (neutral) → add a separate `Inactive` (info) entry and a `Declined`
  (neutral) entry; the legend must reflect one sample badge **per color/category**.
- [ ] `pnpm build` gate green (repo-wide `pnpm lint` is known-broken — build is the gate).
- [ ] Contract: `index.ui.md` legend + status-badge-color table (already updated in this spec).

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

### Considered & rejected — subtree roll-up (2026-07-27)
- **One row per residency** (person appears once per tenant) — user chose per-person dedupe; per-tenant status still visible via badges.
- **Full cross-tenant management from the parent** (block/licenses on child-tenant residents) — user chose read-only; management stays inside the owning tenant, avoiding a second set of DEFINER mutations.
- **Spine scope (ancestors + subtree) for the list** — the roll-up is explicitly the *child* tree; the spine is the Manage-Residents assignment pool's concern.
- **New RLS policies for arbitrary-depth descendant reads** — same rejection as Manage Residents; DEFINER fns are the house pattern.
- **A super-admin (`p:app-admin-super`) carve-out on the new functions** — unnecessary: the super admin is an anchor-tenant admin and/or uses support mode (user answer 2026-07-27).
