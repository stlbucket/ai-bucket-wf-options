# Plan: admin/user subtree roll-up (one-row-per-person list + read-only child detail)

> **Execution Directive:** plan + build this via `/fnb-stack-implementor <this-file>` — execute
> the phases below in order. Source spec: `.claude/specs/tenant-app/admin/user/README.md`
> (Phases 5–8; contract in `_shared.data.md` → "Subtree Roll-up", pages in
> `index.{ui,data}.md` + `[id].{ui,data}.md`). Never run `git`. Never rebuild/restart the env —
> ask the user, then verify read-only.

**Severity: MED** (feature; cross-tenant DEFINER reads, list page rework) · Category: app ·
Identified: 2026-07-27

## Summary

`/tenant/admin/user` rolls up the residents of the current tenant **plus its entire child
subtree** (self + all descendants — not ancestors, not siblings) into a single
**one-row-per-person** list with per-tenant membership badges. Clicking a person with a
current-tenant residency opens the existing management detail; a person who exists only in child
tenants opens the same route **read-only** (no block/license actions). Gate is `p:app-admin` only
(locked: the super admin is an anchor-tenant admin and/or uses support mode). `support`-type and
`removed`-status residencies are excluded everywhere. No new RLS — DEFINER fns, per the
Manage-Residents precedent.

---

## Phase 1 — DB (in-place edits; then USER rebuilds, we verify read-only)

All edits in-place to existing `db/fnb-app/` sqitch files with matching **revert/verify** updates
(all revert/verify files verified present).

1. **`deploy/00000000010230_app_fn_types.sql`** — add composite `app_fn.subtree_resident_row`
   (fields per `_shared.data.md`: resident_id, profile_id nullable, email, display_name,
   full_name, tenant_id, tenant_name, tenant_type, resident_type, resident_status). Anchor: next
   to `app_fn.workspace_resident_candidate` (line 38). Update `revert/` + `verify/` for 10230.

2. **`deploy/00000000010242_app_fn_definers.sql`** (home of the tree helpers —
   `tenant_tree_root` :406, `tenant_tree_ids` :422, `tenant_spine_ids` :441) — add per
   `_shared.data.md`:
   - `app_fn.tenant_subtree_residents(_tenant_id uuid) returns setof app_fn.subtree_resident_row`
     — DEFINER STABLE; scope `r.tenant_id in (select app_fn.tenant_tree_ids(_tenant_id))`
     (the existing helper already computes self + descendants from any node); exclude
     `r.type = 'support'` and `r.status = 'removed'`; coalesce email/display_name from
     profile-or-resident (pending invites have `profile_id null`); order display_name, tenant_name.
   - `app_api.tenant_subtree_residents()` — INVOKER STABLE,
     `perform jwt.enforce_permission('p:app-admin')`, delegate with `jwt.tenant_id()`.
   - `app_fn.subtree_resident_detail(_tenant_id uuid, _resident_id uuid) returns jsonb` — DEFINER
     STABLE; raise `30000` if the target resident is absent or outside
     `tenant_tree_ids(_tenant_id)`; return `{ profile, resident, residencies[] }` where
     residencies = the person's subtree residencies (same support/removed filters) each with
     tenant context + licenses (`id`, `license_type_key`, `status`). SQL sketch in
     `_shared.data.md`.
   - `app_api.subtree_resident_detail(_resident_id uuid)` — INVOKER STABLE, `p:app-admin` guard,
     delegate with `jwt.tenant_id()`.
   - Update `revert/` + `verify/` for 10242. **No new RLS policies.**

3. **STOP → ask the user to rebuild.** Then read-only verification via a rolled-back
   claims-simulated txn over a 3-level tree with a sibling branch:
   - list from the mid-level admin: self + own descendants present (one row per residency),
     ancestors + sibling branch absent; no `support`/`removed` rows; pending (profile-less)
     invite rows present with resident email
   - detail on a grandchild resident → jsonb with profile + subtree-scoped residencies + licenses
   - detail on an ancestor/sibling resident id → `30000`; non-admin claims → `30000`

## Phase 2 — GraphQL client (`packages/graphql-client-api`)

4. **New ops** under `src/graphql/app/query/`:
   - `tenantSubtreeResidents.graphql` — `query TenantSubtreeResidents { tenantSubtreeResidentsList
     { residentId profileId email displayName fullName tenantId tenantName tenantType
     residentType residentStatus } }`
   - `subtreeResidentDetail.graphql` — `query SubtreeResidentDetail($residentId: UUID!) {
     subtreeResidentDetail(_residentId: $residentId) }` (JSON scalar — `siteUserById` precedent)
   - **Verify PostGraphile field/arg names** against `src/generated/fnb-graphql-api.ts` /
     GraphiQL after the rebuild (setof-fn list field inflection, `_resident_id` → `residentId`).
     `postgraphile.tags.json5` nudge only if needed.

5. **Codegen** — `pnpm -F @function-bucket/fnb-graphql-client-api generate`.

6. **Composables** in `src/composables/useAdminResidents.ts` (same file as the existing ones):
   - `useSubtreeResidents(currentTenantId: MaybeRefOrGetter<string | null>)` → groups flat rows
     into `SubtreeUserView[]` (view types `SubtreeUserView` + `SubtreeTenancy` declared here, R4):
     dedupe by `profileId`, pending invites keyed `resident:${residentId}` as their own rows;
     `currentResidentId`/`currentStatus` from the row matching `currentTenantId`;
     `linkResidentId` = current-tenant resident id, else first tenancy's; tenancies
     current-tenant-first then by tenantName. Returns `{ users, fetching, error, executeQuery }`.
   - `useSubtreeResidentDetail(id: string, pause?: Ref<boolean>)` → wraps the detail query with
     `pause`; returns `{ data, fetching, error }`, data raw (lowercase pg enum strings).
   - Barrel `src/index.ts` already exports `./composables/useAdminResidents` — confirm, don't
     duplicate. Build: `pnpm -F @function-bucket/fnb-graphql-client-api build`.
   - The `TenantResidents` op (`appTenantResidents.graphql`) **stays** — `useAdminResidents()` is
     still exported and the op family is referenced elsewhere (`useMsgTopics`, `useTodoDetail`
     reference the resident queries) — only the page stops using it.

## Phase 3 — tenant-app UI (`apps/tenant-app`)

7. Re-export: extend `apps/tenant-app/app/composables/useAdminResidents.ts` with
   `useSubtreeResidents, useSubtreeResidentDetail`.

8. **`SubtreeResidentList.vue`** (`app/components/`) — props `users: SubtreeUserView[]`; UTable
   **v4 API** (`accessorKey`/`header`, cell slots via `row.original` — UC13): Name (link to
   `/admin/user/{linkResidentId}`), Email, Status (badge of `currentStatus`, `—` when null),
   Tenants (one status-colored `UBadge` per tenancy, `variant="subtle"`, flex-wrap). Shared
   status→color map per `index.ui.md`. `UEmpty` for zero rows (UC8); `overflow-x-auto` (UC5).

9. **`app/pages/admin/user/index.vue`** — swap `ResidentList` → `SubtreeResidentList` fed by
   `useSubtreeResidents(user.value?.tenantId)`; subtitle → people count (+ `across N tenants`
   when N > 1); `WorkspaceResidentsModal @changed` → the new `executeQuery` network-only.
   Invite/Manage-Residents gating unchanged. `ResidentList.vue` — check remaining consumers;
   delete only if none.

10. **`app/pages/admin/user/[id].vue`** — read-only fallback: when `useAdminResident(id)` settles
    with `data === null`, unpause `useSubtreeResidentDetail(id)`; render per `[id].ui.md`:
    persistent info `UAlert` ("Read-only — resident of {tenantName}…"), info card without any
    action buttons, residencies card (tenant badge + type + status + license keys, read-only);
    normalize lowercase enum strings before the badge map. `30000` from the fallback → error
    state, no retry. Route `/admin/**` already `ssr: false` (`nuxt.config.ts:31` — UC14 covered).

11. **`pnpm build`** gate green (repo-wide `pnpm lint` is known-broken).

## Phase 4 — spec upkeep

12. Flip the roll-up statuses to Implemented across the five spec files, check Phase 5–8 boxes in
    the README, record corrections. Ask the user before moving this plan to `addressed/`.

---

## Verification (end-to-end, read-only)

- As an admin of a tenant **with** children: list shows people from self + all descendants, one
  row per person, tenant badges correct; a child-only person's detail is read-only (alert, no
  buttons); a current-tenant person's detail keeps full management.
- As an admin of a leaf tenant (no children): list ≡ today's list, grouped.
- Network tab: `POST /graphql-api/api/graphql` with `TenantSubtreeResidents` /
  `SubtreeResidentDetail`; no console ESM/barrel errors.

## Risks / notes

- **Grouping edge**: a person can hold multiple residencies; `currentStatus` deliberately shows
  only the acting tenant's status — per-tenant status lives on the badges.
- **Detail route semantics unchanged** (`[id]` = resident id) — the read-only fallback fires only
  on RLS miss, so no behavior change for existing links.
- **PostGraphile inflection** of the setof-fn list field + JSON-scalar fn is confirmed in Phase
  2.4 before composables are finalized.
