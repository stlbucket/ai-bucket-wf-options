# home-app/index — Landing Page UI

## Status
Implemented — greeting removed 2026-08-07 (tabs-only logged-in view, both breakpoints; built via
plan `0690`, `pnpm build` green). Superseding history: workspace-cards redesign 2026-07-27
(module-grid landing replaced), then the single-column `HomeNarrative` tab layout (`WorkspaceCards`
folded in as the leading tab). Hero (logged-out) view unchanged throughout.

## Route
`/` → `apps/home-app/app/pages/index.vue`

## Required Permission
None — public page. Auth state determines which view renders.

## Layout

Two mutually exclusive views based on `useAuth().isLoggedIn`:

---

### Logged-Out: Hero View (`v-if="!isLoggedIn"`)

**Unchanged** from the current implementation:

Full-viewport-height centered column:

- `<FunctionBucketMark size="lg" />` — SVG logo at large size
- Heading: `function-bucket` (monospace, bold)
- Subheading: `your tools. in a bucket.` (muted)
- `<UButton>` linking to `${authAppUrl}/login` (external href, `size="xl"`, label: `sign in`)
- `<ULink>` to `${authAppUrl}/forgot-password` (muted, small)

The one-shot `?session=expired` toast (claims-revalidation-pattern.md) also stays as-is.

---

### Logged-In: `HomeNarrative` Tab View (`v-else`)

Single-column, one layout at **every** width (no mobile/desktop split): a constrained
`mx-auto max-w-3xl` padding shell holding **only** `<HomeNarrative with-workspaces>` — a `UTabs`
strip. There is **no greeting** and no subheading above it (see "Removed from this page").

The tools grid was already dropped in the 2026-07-27 redesign (the sidebar nav is the tools
surface); the tenant/workspace context chips are likewise gone (the Current badge on the cards
supersedes them).

**Tabs (`HomeNarrative.vue`, `variant="link"`, `list: overflow-x-auto` so they scroll rather
than wrap on narrow screens):**
- **Workspaces** (`i-lucide-building-2`) — leading, default-selected; `#workspaces` slot renders
  `<WorkspaceCards />`. Folded in via the `with-workspaces` prop so the desktop right-hand
  workspace column and the mobile view share one strip.
- **What it is** (`i-lucide-box`), **How it's built** (`i-lucide-wand-sparkles`),
  **For developers** (`i-lucide-terminal`) — the static narrative prose.

**`WorkspaceCards.vue` (`apps/home-app/app/components/`) — the workspace switcher tree laid out
as tenant cards** (self-contained: own `refreshClaims` on mount + switch state):

- One `UCard` (UC4) per **root tenant** node from `useResidencySwitcher().roots` (the same
  claims-derived tree the sidebar `WorkspaceSwitcher` modal renders), keyed by `tenantId`
- Container: `flex flex-wrap` of cards, **three to a row on big screens** — card widths
  `basis-full sm:basis-[calc(50%-0.5rem)] lg:basis-[calc(33.333%-0.75rem)]` (mobile-first,
  UC5); `items-start` so short cards don't stretch
- **Card header** = the root tenant itself (it is a selectable node):
  - `i-lucide-building-2` icon + tenant name (truncate)
  - `Current` badge (`color="primary" variant="subtle"`) when `isCurrent`
  - Status badge (UC1 shared tenant/resident status maps — same `statusBadge` priority logic as
    `WorkspaceSwitcher.vue`) when the node exists but is not enterable
  - Lock icon `i-lucide-lock` (muted) when the root is a **ghost node** (`residentId === null`)
  - Header is clickable when `canEnter` (hover affordance); spinner `i-lucide-loader-circle`
    animate-spin replaces the trailing area while this node's switch is in flight
- **Card body** = `<ResidencyTree :nodes="node.children" …/>` — the workspace tree under that
  tenant. Omitted entirely when the tenant has no children (header-only card)

**Empty / loading states:**
- `roots.length === 0` while the on-mount `refreshClaims()` is in flight → `USkeleton` card
  placeholders (mirror the switcher modal's skeleton treatment)
- `roots.length === 0` and not refreshing → `<UEmpty icon="i-lucide-building-2"
  label="no workspaces yet" description="ask your admin for an invitation" />`
- A thin `UProgress size="xs"` above the cards while the background refresh is in flight
  (cards render instantly from localStorage claims underneath it)

**Support mode (`p:exit-support` held):** cards render **display-only** — no node is clickable
(switching residency would silently drop the support session; same rule as the sidebar
switcher's static trigger). Tooltip on hover: `Exit support to switch`.

## Component: `ResidencyTree.vue` (new, shared)

`packages/tenant-layer/app/components/ResidencyTree.vue` — the `UTree` rendering extracted
from `WorkspaceSwitcher.vue` so the modal and the landing cards share one implementation
(home-app extends tenant-layer, so it resolves in both consumers).

Presentational only (R2 — no API calls, no switch logic):

| Prop | Type | Purpose |
|---|---|---|
| `nodes` | `ResidencySwitchNode[]` | Nodes to render (modal passes `roots`; landing cards pass `node.children`) |
| `disabled` | `boolean` | A switch is in flight (or support mode) — suppress selection |
| `switchingTenantId` | `string \| null` | Node showing the in-flight spinner |

| Emit | Payload | When |
|---|---|---|
| `select` | `ResidencySwitchNode` | An enterable node is clicked (component pre-filters `canEnter`/`residentId`) |

Item rendering carried over verbatim from `WorkspaceSwitcher.vue`: `i-lucide-network`
(workspace) / `i-lucide-building-2` (tenant) icons, `defaultExpanded`, disabled ghosts,
`Current` badge, status badge fallback, lock icon trailing for ghosts, spinner while switching.

`WorkspaceSwitcher.vue` is refactored to consume `ResidencyTree` in its modal body and own the
switch call itself (see `docs/specs/workspace-switcher/switcher.ui.md`).

## Component: `FunctionBucketMark.vue`
Unchanged. Props: `size?: 'sm' | 'md' | 'lg'` (default: `'md'`).
SVG logo using `var(--ui-primary)` for color — no hardcoded colors.

## User Interactions
| Action | Trigger |
|---|---|
| Sign in | Click "sign in" button → navigates to auth-app login |
| Switch residency | Click an enterable node (card header or tree row) → `switchResidency(residentId)`: `assumeResidency` → `refreshClaims` → full reload to `/` (identical contract to the sidebar switcher) |
| Current node | Not clickable; `Current` badge |
| Ghost/blocked node | Not clickable; lock icon or status badge explains why |
| Support mode | Nothing clickable; tooltip `Exit support to switch` |

## Removed from this page
**2026-08-07:**
- The `hey, {firstName}.` greeting heading — dropped on **both** breakpoints (user directive).
  The logged-in view is now tabs-only; the `firstName` computed and its `user` dependency are no
  longer needed on the page. (Rationale: on mobile the greeting + tab strip rendered awkwardly;
  the greeting carried no navigation value, so it goes at all widths, not just mobile.)

**2026-07-27 redesign:**
- Module/tools grid (`useAppNav().availableSections`, `ModuleNavSection`-style rows, accent
  cycling) — tools live in the sidebar nav only
- Tenant/workspace context chips under the greeting
- `here's what's in your bucket` subheading copy
