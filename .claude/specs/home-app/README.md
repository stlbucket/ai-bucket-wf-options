# home-app — Landing Page

> **Execution Directive:** plan + build this spec via
> `/fnb-stack-implementor .claude/specs/home-app/README.md` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
Implemented — workspace-cards redesign 2026-07-27 (`pnpm build` gate green; browser-verified
at all three breakpoints + switcher modal post-refactor). The previous module-grid logged-in
view is replaced; the hero view is unchanged.

## Purpose

The home landing page (`/`, home-app) is the post-login default destination. Today its
logged-in view lists the available tools (the `useAppNav` module grid). This redesign replaces
that with a **listing of workspaces grouped by tenant** the user is a member of: one card per
root tenant, the tenant's workspaces nested in a tree inside the card — the sidebar workspace
switcher popup's content, laid out as flex cards, three to a row on big screens. Clicking an
enterable node switches residency exactly like the popup. Tools remain reachable via the
sidebar nav only.

## Locked decisions (2026-07-27)

| Decision | Choice | Why |
|---|---|---|
| Landing content | Workspace cards replace the tools/module grid entirely | User directive — the sidebar nav is the tools surface; the landing becomes the residency picker |
| Card grouping | One `UCard` per **root tenant** from `useResidencySwitcher().roots`; children rendered as a tree in the card body; header-only card when no children | "Workspaces grouped by tenant … in a tree" — the root tenant is itself a selectable residency, so it lives in the card header |
| Layout | `flex flex-wrap`, three cards per row on `lg`, two on `sm`, one on mobile | User directive ("flex cards, three to a row on big screens") + UC5 mobile-first |
| Node click | Switch residency — same contract as the switcher modal (`assumeResidency` → `refreshClaims` → full reload to `/`) | User choice. One switching mechanism everywhere; Current/ghost/blocked nodes disabled with the same badges |
| Freshness | `refreshClaims()` on mount; render instantly from localStorage underneath | User choice — mirrors the switcher modal's on-open refresh; one existing round trip |
| Context chips | Dropped | User choice — the Current badge on the cards supersedes them |
| Tree rendering | Extract `ResidencyTree.vue` (presentational, emits `select`) into tenant-layer; both `WorkspaceSwitcher.vue` and the landing page consume it | DRY — identical item rendering (icons, badges, ghosts, spinner); R2 keeps the switch call in the consumers |
| Support mode | Cards display-only while `p:exit-support` held; tooltip `Exit support to switch` | Same invariant as the switcher's static trigger — switching would drop the support session |
| Data source | Claims only (`ProfileClaims.residencies`) — no new GraphQL operation | The tree already rides claims (workspace-switcher spec); nothing new to fetch |
| Hero view | Unchanged | Redesign scope is the logged-in view only |

## Files in this spec

| File | Covers |
|---|---|
| `README.md` | This index |
| `index.ui.md` | Hero view (unchanged), workspace-cards view, `ResidencyTree.vue` contract, interactions |
| `index.data.md` | Composables (`useAuth`, `useResidencySwitcher`), reactive state, no-new-ops note |

Related: `.claude/specs/workspace-switcher/` (tree data + switch mechanism — consumed, not
changed; its `WorkspaceSwitcher.vue` is refactored onto the shared `ResidencyTree.vue`).

## Implementation Task List

### Phase 1 — shared tree component (tenant-layer)
- [x] `packages/tenant-layer/app/components/ResidencyTree.vue`: extract the `UTree` body from
      `WorkspaceSwitcher.vue` — props `nodes` / `disabled` / `switchingTenantId`, emit
      `select(node)`; item rendering (icons, Current/status badges, ghost lock, spinner)
      carried over verbatim
- [x] Refactor `WorkspaceSwitcher.vue` to consume `ResidencyTree` (modal keeps trigger,
      on-open refresh, switch call, toasts)

### Phase 2 — landing page (home-app)
- [x] `apps/home-app/app/pages/index.vue`: replace the module grid + context chips with the
      tenant cards view (flex-wrap, 3-up on `lg`); header-only cards for childless tenants;
      subheading → `your workspaces`
- [x] On-mount `refreshClaims()` with `UProgress` + skeleton/empty states; support-mode
      display-only guard
- [x] Switch flow on the page: `switchResidency` on `select`, spinner via
      `switchingTenantId`, error toast on failure
- [x] Remove now-dead page code (`useAppNav` import, accent cycling, chip derivations)

### Phase 3 — verify + spec upkeep
- [x] `pnpm build` gate green (13/13, 2026-07-27)
- [x] Visual check at all three breakpoints (UC5) — verified in Chrome 2026-07-27
      (lg 3-up shell / sm / mobile; user-approved)
- [x] Verify the sidebar switcher modal renders post-refactor — verified 2026-07-27 (tree,
      ghost locks, Current badge identical; actual switch + support-mode not re-exercised —
      switch logic untouched by the refactor)
- [x] README status → Implemented; boxes checked; no corrections needed (code follows spec);
      synced `.claude/specs/workspace-switcher/switcher.ui.md` with the `ResidencyTree` split

## Remaining Open Questions
None — decisions locked 2026-07-27.

## Considered & rejected

- **Keep the tools grid below the cards** — user directive says the landing no longer shows
  tools; the sidebar nav already covers them.
- **Keep the tenant/workspace context chips** — redundant once every card marks the current
  node with a badge.
- **CSS grid (`lg:grid-cols-3`) instead of flex-wrap** — equivalent result; user asked for
  flex cards, and flex-wrap handles the last-row-of-two case without stretching.
- **A new GraphQL query for the card data** — the residency tree already rides
  `ProfileClaims.residencies`; a second delivery path would reintroduce exactly what the
  workspace-switcher spec removed (its rejected `fetchMyResidencyTree`).
- **Duplicate the tree markup on the page instead of extracting `ResidencyTree.vue`** —
  two copies of the badge/ghost/spinner logic to keep in sync.
