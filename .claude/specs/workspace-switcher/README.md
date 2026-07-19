# workspace-switcher — Sidebar Tenant/Workspace Switcher

> **Execution Directive:** plan + build this spec via
> `/fnb-stack-implementor .claude/specs/workspace-switcher/README.md` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
Implemented — GraphQL (claims delivery), 2026-07-10. Decisions locked 2026-07-10, revised same
day: residencies ride `ProfileClaims` (user directive) instead of a separate switcher query.
Verified end-to-end (DB rolled-back claims simulation + GraphQL create/enter/switch-back flow
as `bucket@`, incl. grandchild + ghost-ancestor cases). See §Implementation corrections.

## Purpose

Give a logged-in user a way to switch between their residencies (tenants and nested workspace
tenants) without going back through `/auth/login`. The top of the tenant-layer sidebar shows the
**current tenant** as a button; clicking it opens a **modal with a browsable tree** of every
tenant the user holds a residency in, arranged by `parent_tenant_id` hierarchy. Selecting an
enterable node runs the existing switch mechanism (`assume_residency` → `refreshClaims` → full
reload to `/`).

The switch mechanism already exists end-to-end (login residency modal, workspace Enter, support
mode). What's missing is (a) a persistent UI surface for it and (b) **tree data**: the current
`my_profile_residencies` returns resident rows with a denormalized `tenant_name` only — RLS hides
other tenants' rows, so the client cannot see parentage. A new SECURITY DEFINER tree function
closes that gap, and its rows travel to the client **inside `ProfileClaims`** — the same
localStorage claims that already drive the nav (`modules`), fetched by the same
`CurrentProfileClaims` document.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| UI pattern | Current-tenant button at top of sidebar → `UModal` with a `UTree` of residencies | User choice (2026-07-10) over flat dropdown / popover. Scales with nested workspaces; the trigger doubles as a "where am I" indicator. `UTree` confirmed present in Nuxt UI 4.6.1 (UC3). |
| Post-switch destination | `navigateTo('/', { external: true })` — full reload into home-app | Same contract as workspace Enter and support-mode entry; guarantees nav/claims/urql caches rebuild under the new tenant. |
| Tenants without a residency (gaps) | **Ghost ancestor nodes** — the tree function walks `parent_tenant_id` up from every residency tenant and returns ancestors too; nodes with `resident_id = null` render disabled/muted | User choice. Hierarchy stays truthful when you hold a residency in a grandchild workspace but not its parent. |
| Mobile | Same `WorkspaceSwitcher` component in the `AppNavMobile` drawer header, opening the same modal | UC5 (responsive is mandatory); cheapest compliant placement. |
| Tree data source (DB) | New composite type `app_fn.residency_tree_node` + `app_fn.my_residency_tree(_email)` (SECURITY DEFINER) + `app_api.my_residency_tree()` (INVOKER) | RLS on `app.tenant` only exposes the active tenant + its direct children; a DEFINER walk mirrors the `my_profile_residencies` precedent. Composite type lives in `00000000010230_app_fn_types.sql` (the `profile_claims` precedent). |
| Delivery to the client | **Inside `ProfileClaims.residencies`** — `myResidencyTreeList` is selected in the existing `CurrentProfileClaims` GraphQL document and mapped by `fetchProfileClaims`, exactly like `modules`/`availableModules` | User directive 2026-07-10 (supersedes the separate on-open query). Claims are already the nav-driving client state; the switcher renders instantly from localStorage, no new fetch machinery. |
| Server-side claims composite | **Not touched** — `app_fn.profile_claims` does not gain a residencies field; the raw-pg server path leaves `ProfileClaims.residencies` null | `claims_for_session` rebuilds server claims on **every request**; nothing server-side consumes residencies (`buildJwtPayload` forwards neither `modules` nor `residencies`). Asymmetry precedent: client `modules` come from `availableModules`, not the composite. |
| Staleness | `refreshClaims()` runs on every modal open | One existing round trip; claims (and therefore the tree) are as fresh as any other claims consumer. |
| Switch action home | `useAuth().switchResidency(residentId)` in `auth-ui` — `assumeResidency` → `refreshClaims()` → `navigateTo('/', { external: true })` | Identical shape to the neighboring `exitSupport`. Note `goHome()` is a soft `navigateTo('/')` — the switch navigates explicitly with `external: true` (workspace-Enter full-reload contract) instead of reusing or changing `goHome`. `auth-ui` already depends on `graphql-client-api`. |
| Tree-derivation composable home | `useResidencySwitcher()` in `auth-ui` (claims → tree), re-exported through `auth-layer` `app/composables/` like `useAuth` | Derives purely from claims (the `useAppNav`-from-`modules` precedent); keeps tenant-layer free of any new package dependency. |
| Enterable statuses | Reuse `ENTERABLE_STATUSES` from `useWorkspaces` (`INVITED, ACTIVE, INACTIVE, SUPPORTING`) + tenant `ACTIVE` + not the current residency | One source of truth for "can I assume this residency"; extract to a shared export in `graphql-client-api` (`useResidency.ts`) consumed by both `useWorkspaces` and `auth-ui`. |
| Support mode | Trigger renders **static** (name only, no modal) while `p:exit-support` is held | Switching residency mid-support would silently drop the support session; Exit Support stays the only path out. |
| Single residency | Trigger still renders and opens the modal (one-node tree) | It doubles as the current-context indicator; hiding it makes the sidebar layout jump between users. |
| Component home | `packages/tenant-layer/app/components/WorkspaceSwitcher.vue`, self-contained (owns trigger + modal state) | `WorkspaceCreateModal` precedent; used by both `AppNav` and `AppNavMobile`. |
| DB delivery | In-place edits to existing sqitch deploy files | Rebuild-only env; house rule (no new migrations/reworks). |

## Files in this spec

| File | Covers |
|---|---|
| `README.md` | This index |
| `_shared.data.md` | Composite type, DB functions, permission model, `fnb-types` additions (incl. `ProfileClaims.residencies`) |
| `switcher.data.md` | Claims-document extension, `fetchProfileClaims` mapping, `useResidencySwitcher` + `switchResidency`, switch flow |
| `switcher.ui.md` | `WorkspaceSwitcher.vue` component, `AppNav`/`AppNavMobile` placement, interactions |

## Implementation Task List

### Phase 1 — DB (in-place edits, then env rebuild by the user)
- [x] `00000000010230_app_fn_types.sql`: add `app_fn.residency_tree_node` composite type
- [x] `00000000010240_app_fn.sql`: add `app_fn.my_residency_tree(_email)` (SECURITY DEFINER,
      recursive ancestor walk) + `app_api.my_residency_tree()` (INVOKER) next to
      `my_profile_residencies`
- [x] **Ask the user to rebuild** (never rebuild yourself), then verify read-only via a
      claims-simulated transaction: multi-tenant user sees all residencies; nested-workspace
      residency yields ghost ancestor rows; anon (`jwt.email()` null) yields empty set

### Phase 2 — types + GraphQL client + auth-ui
- [x] `fnb-types`: `ResidencyTreeNode` interface (`src/residency-tree.ts`) + barrel export;
      `ProfileClaims` gains `residencies: ResidencyTreeNode[] | null`
- [x] Extend `packages/graphql-client-api/src/graphql/app/query/currentProfileClaims.graphql`
      with `myResidencyTreeList { …all fields }` (the `availableModules` precedent); codegen run
- [x] `fetchProfileClaims` (`useProfileClaims.ts`) maps the new field into
      `ProfileClaims.residencies`; db-access server-path claims leave it `null` (verify the
      fnb-types field is nullable so both paths type-check)
- [x] `ENTERABLE_STATUSES` extracted to a shared export in `useResidency.ts` (consumed by
      `useWorkspaces` + auth-ui)
- [x] `auth-ui`: `useResidencySwitcher()` (claims → tree; `canEnter`/`isCurrent`) in
      `src/use-residency-switcher.ts`; `switchResidency(residentId)` added to `useAuth`
      (`assumeResidency` → `refreshClaims` → `goHome`); barrel exports

### Phase 3 — layer UI (no new tenant-layer deps)
- [x] `packages/auth-layer/app/composables/useResidencySwitcher.ts` thin re-export (the
      `useAuth.ts` re-export precedent)
- [x] `packages/tenant-layer/app/components/WorkspaceSwitcher.vue` (trigger + modal + UTree)
- [x] `AppNav.vue`: insert between Brand and Sections; `AppNavMobile.vue`: insert under the
      drawer brand row
- [x] `docker compose restart` of the tenant-layer apps (layer edits don't hot-reload); `pnpm
      build` gate green

### Phase 4 — spec upkeep
- [x] README status → Implemented; boxes checked; corrections section added if code diverged

## Implementation corrections (2026-07-10)

- **`goHome()` was already a full reload** — `use-auth.ts` navigates with
  `navigateTo(homeUrl, { external: true })`, so the spec/plan note about an explicit
  `{ external: true }` navigate inside `switchResidency` was stale. `switchResidency` simply
  mirrors the neighboring `exitSupport`: `assumeResidency` → `refreshClaims` → `goHome()`.
- **`residencies: null` is defaulted centrally**, in db-access `normalize-claims.ts`
  (`claims.residencies ??= null`) — all three raw-pg claim producers
  (`currentProfileClaims` / `profileClaimsForUser` / `claimsForSession`) funnel through it;
  there are no per-file `ProfileClaims` literals in db-access to touch.
- **`tenantName` mapping coerces with `?? ''`** in `fetchProfileClaims` — the generated
  composite-return fields are all `Maybe<>`, and `ResidencyTreeNode.tenantName` is non-null.
- The auth-layer re-export wraps in a function (exactly the `useAuth.ts` precedent shape) and
  also re-exports the `ResidencySwitchNode` type for the component.
- Verified inflected GraphQL field names match the spec draft exactly:
  `tenantId · tenantName · tenantType · tenantStatus · parentTenantId · residentId ·
  residentStatus · residentType` on type `ResidencyTreeNode`, query field `myResidencyTreeList`.

## Remaining Open Questions
- **Entering with `INVITED` status skips the invitation ceremony** — inherited from
  `ENTERABLE_STATUSES` in `useWorkspaces` (pre-existing behavior, not widened here). Revisit if
  invitation acceptance ever needs to be a hard gate.
- **Very deep/wide trees** — no pagination or search in the modal for now; the modal scrolls.
  Add a filter input if real usage demands it.
- ~~**Login residency modal could consume claims too**~~ — **Done 2026-07-11** (user directive:
  "blow it away"). The login page now reads `claims.residencies` (ghost nodes filtered on
  `residentId !== null`) instead of a `fetchMyResidencies` round trip. Removed with it, as the
  chain had no other consumers: `fetchMyProfileResidencies` (`useResidency.ts`), the
  `fetchMyResidencies` wrapper (`auth-app useLoginFlow.ts`), and the now-orphaned
  `ProfileResidency` type (`fnb-types/src/profile-residency.ts` + barrel line).
  `ResidencySelectModal.vue` takes `ResidencyTreeNode[]` and selects by `residentId`. The
  `MyProfileResidencies` GraphQL document + `useMyProfileResidenciesQuery` hook **stay** —
  `useWorkspaces` still consumes them. `pnpm build` green; dist verified free of the export.

## Considered & rejected

- **Separate on-open switcher query (`fetchMyResidencyTree`)** — the spec's first draft.
  Superseded by the claims delivery (user directive 2026-07-10): an extra operation + imperative
  fetch machinery for data that naturally belongs with the claims that already drive the nav.
- **Putting residencies into the `app_fn.profile_claims` composite** — `claims_for_session`
  rebuilds server claims on every request; the recursive walk would run per-request for a field
  nothing server-side reads. Client-document delivery matches the existing `modules` asymmetry.
- **Bare `{ id, name }` pairs in claims** — not enough for the locked UI: the tree needs
  `parentTenantId` (hierarchy), tenant status/type and resident id/status (ghost nodes,
  disabled states, `canEnter`).
- **Flat `UDropdownMenu` at the top of the sidebar** — cheapest, and could have shipped on
  `myProfileResidencies` alone, but flattens the workspace hierarchy the workspace feature just
  introduced.
- **`UPopover` instead of `UModal`** — lighter feel but cramped for deep trees; modal chosen.
- **Flatten orphaned residencies to the root** (no ghost nodes) — simpler function, misleading
  hierarchy.
- **Live reactive tree query in the sidebar** — pays a query on every page render for data only
  needed on modal open.
- **Denormalizing `parent_tenant_id` onto `app.resident`** — spreads tenant topology into a
  second table; the DEFINER walk keeps `app.tenant` the single source of parentage.
- **Reusing `setof app.resident` as the return type** — ghost ancestor nodes have no resident
  row to return; composite type required.
