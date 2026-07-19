# workspace-switcher — UI

Data contract: `switcher.data.md`. Shared types/permissions: `_shared.data.md`.

## Status
Implemented — GraphQL (claims delivery), 2026-07-10. Decisions locked 2026-07-10 (revised same
day: tree renders from `ProfileClaims.residencies`). Corrections: README §Implementation
corrections.

## Component — `packages/tenant-layer/app/components/WorkspaceSwitcher.vue`

Self-contained (owns its modal `open` state and renders its own trigger — the
`WorkspaceCreateModal` precedent). No props, no emits. Reads `useAuth()` for claims and
`useResidencySwitcher()` (auth-layer re-export) for the derived tree + switch action. All data
comes from localStorage claims — the component performs no fetch beyond `refreshClaims()` on
modal open.

### Render states

| State | Render |
|---|---|
| not logged in / no `tenantName` in claims | nothing (`v-if`) |
| support mode (`user.permissions` includes `p:exit-support`) | **static** row — tenant name + `i-lucide-building-2`, no chevrons, not clickable, `title="Exit support to switch"` |
| normal | trigger button (below) |

### Trigger (sidebar row)

A full-width button styled like the sidebar's existing rows (dark context — `bg-blue-900`
sidebar; text `text-white/85`, `hover:bg-white/10 hover:text-white`, rounded, `px-2.5 py-2`):

```
┌────────────────────────────┐
│ 🏢  Acme Corp           ⇅ │   i-lucide-building-2 · truncated tenantName · i-lucide-chevrons-up-down
└────────────────────────────┘
```

- Label: `user.tenantName`, `truncate`.
- `aria-label="Switch workspace"`.
- Click → `open = true` + kick off `refreshClaims()` (see modal refreshing state). The tree
  renders immediately from the current claims; the refresh only updates it if something changed.

### Modal

`UModal` — `title="Switch workspace"`, default dismissible (unlike the login modal — there is
always a current tenant to stay in). Body, top to bottom:

1. **Refreshing**: the tree renders instantly from localStorage claims; while the on-open
   `refreshClaims()` is in flight show a subtle indicator (e.g. `UProgress` line or spinner in
   the header area). If claims were somehow empty (`residencies` null/empty), show `USkeleton`
   rows until the refresh resolves.
2. **Refresh error**: keep showing the last-known tree (claims are still valid locally) and
   toast the failure (UC7) — do not blank the modal.
3. **Tree**: `UTree` (Nuxt UI 4.6.1) fed from `roots`, all nodes `defaultExpanded`. Node
   mapping (`ResidencySwitchNode` → tree item):

| Node state | Label rendering | Selectable |
|---|---|---|
| `isCurrent` | tenantName + `UBadge` `color="primary"` `variant="subtle"` "Current" | no (`disabled`) |
| `canEnter` | tenantName | **yes** — select switches immediately |
| ghost (`residentId === null`) | tenantName muted (`text-muted`) + `i-lucide-lock`, `title="No residency in this workspace"` | no (`disabled`) |
| residency but not enterable (tenant not `ACTIVE`, or `residentStatus` ∉ `ENTERABLE_STATUSES`) | tenantName muted + status `UBadge` via shared auth-layer `statusColor('tenant' \| 'resident', …)` / `statusLabel` utils (UC1 — no per-component color maps) | no (`disabled`) |

   Node icon: `i-lucide-building-2` for root tenants, `i-lucide-network` for `WORKSPACE`-type
   tenants (matches the Workspaces tool icon).
4. **Footer**: single `Cancel` button (`variant="ghost"`), right-aligned.

### Interactions

| Interaction | Behavior |
|---|---|
| open modal | tree renders from claims immediately; `refreshClaims()` runs in the background and `roots` recomputes when it lands |
| select enterable node | set a `switching` flag (disables the tree, shows loading on the node/button) → `switchResidency(node.residentId)` — internally `assumeResidency` → `refreshClaims` → `goHome()`; the full reload ends the interaction; the modal never needs to close itself |
| switch fails | `useToast` error toast (UC7); `switching` cleared; modal stays open |
| select disabled node | nothing (UTree `disabled`) |
| Cancel / overlay / Esc | modal closes; no state change |

### Reactive state (component-local)

```ts
const open = ref(false)
const switching = ref(false)          // a switch is in flight
const refreshing = ref(false)         // the on-open refreshClaims is in flight
// roots + switchResidency come from useResidencySwitcher() (claims-derived, reactive)
```

## Placement

### `AppNav.vue` (desktop sidebar)

Insert between the Brand block and the Sections block, visually anchored to the brand area:

```
<!-- Brand -->
<NuxtLink …>function-bucket</NuxtLink>

<WorkspaceSwitcher />          ← new; sits directly under the brand's bottom border

<!-- Sections -->
<div class="flex flex-1 …">
```

### `AppNavMobile.vue` (drawer)

Inside the `USlideover` content, directly under the brand/close header row (same dark styling —
the drawer is also `bg-blue-900 text-white`):

```
<div class="flex items-center justify-between border-b …">brand + ✕</div>
<WorkspaceSwitcher />          ← new
<div class="flex flex-1 flex-col gap-4 overflow-y-auto">sections…</div>
```

The modal stacks above the open slideover; the full-page reload after a successful switch
disposes of both. The bottom tab bar itself is **not** touched (no fifth tab).

## Icons (UC11 — verified lucide names)

`i-lucide-building-2` · `i-lucide-chevrons-up-down` · `i-lucide-network` · `i-lucide-lock`

## Notes

- Layer edits don't hot-reload — `docker compose restart` the tenant-layer apps
  (home-app, tenant-app) after changes; never a full rebuild.
- Dark-context styling is hand-rolled Tailwind on the trigger (matching the existing sidebar
  rows, which already deviate from token colors by design); the modal body uses standard Nuxt
  UI tokens (UC6) since it renders on the default surface.
