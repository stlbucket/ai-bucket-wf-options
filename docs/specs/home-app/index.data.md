# home-app/index — Landing Page Data

## Status
Implemented — workspace-cards redesign 2026-07-27.

## Route
`/` — see `index.ui.md` for UI details

## Data

**No new GraphQL operations and no server API calls.** The workspace cards render from the same
claims-derived residency tree the sidebar switcher uses (`ProfileClaims.residencies` in
localStorage, delivered by the existing `CurrentProfileClaims` document — see
`docs/specs/workspace-switcher/switcher.data.md`). The only network activity is the
on-mount `refreshClaims()` (one existing round trip) and the switch flow itself.

## Composables

### `useAuth()` — from `packages/auth-ui` (via auth-layer re-export)
- `isLoggedIn: Ref<boolean>` — selects hero vs. cards view
- `user: Ref<ProfileClaims | null>` — localStorage claims (`useStorage('auth.user', …)`)
- `refreshClaims()` — called **on mount** of the logged-in view (mirrors the switcher modal's
  on-open refresh): cards render instantly from current claims; the refresh updates the tree in
  the background. Failure keeps the last-known tree and toasts
  (`Could not refresh workspaces`, UC7)
- `user.permissions` includes `p:exit-support` → support mode, cards display-only

### `useResidencySwitcher()` — from `packages/auth-ui` (via auth-layer re-export)
Already implemented (workspace-switcher spec) — consumed unchanged:
- `roots: ComputedRef<ResidencySwitchNode[]>` — root tenants with nested `children`, each node
  carrying `isCurrent` / `canEnter` / ghost (`residentId === null`) state
- `switchResidency(residentId)` — `assumeResidency` → `refreshClaims()` → `goHome()` (full
  external reload). The **page** owns this call (R2 — `ResidencyTree.vue` only emits `select`);
  on throw: toast `Failed to switch workspace`, clear the in-flight state

### `useAppNav()` — **no longer used by this page**
The sidebar (`AppNav` / `AppNavMobile` in tenant-layer) remains its consumer; nothing else
changes in the nav registration (R14 untouched).

### `useRuntimeConfig().public.authAppUrl`
Unchanged — constructs the hero view's sign-in / forgot-password links.

## Reactive state (logged-in view)

```ts
refreshing: Ref<boolean>          // on-mount refreshClaims in flight → UProgress
switching: Ref<boolean>           // a switch is in flight → whole tree disabled
switchingTenantId: Ref<string | null>  // which node shows the spinner
```

## Types
`ProfileClaims`, `ResidencyTreeNode` from `@function-bucket/fnb-types` (R3);
`ResidencySwitchNode` (view type) from `@function-bucket/fnb-auth-ui`, re-exported through
auth-layer's `useResidencySwitcher.ts` (R4 precedent). No db-types involved on this page.

## SSR
home-app pages render with the tenant-layer shell; this page performs no urql query of its own
(claims come from localStorage + `refreshClaims`), matching the current implementation. Keep the
page's existing rendering mode — no UC14 change required.

## Open Questions
None — all decisions locked 2026-07-27 (see `README.md`).
