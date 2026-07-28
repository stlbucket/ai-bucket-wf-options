# home-app landing — workspace cards replace the tools grid

> **Execution Directive:** execute this plan via `/fnb-stack-implementor <this-file>`.
> Spec: `.claude/specs/home-app/README.md` (decisions locked 2026-07-27). When done, ask the
> user (yes/no) before moving this file to `.claude/issues/addressed/`.

**Severity:** MED — UX redesign of the post-login landing; no data-layer or DB change.

## What / Why

The `/` landing page's logged-in view currently lists available tools (the `useAppNav` module
grid). Replace it with a listing of the user's residencies: one card per **root tenant** from
`useResidencySwitcher().roots`, that tenant's workspaces as a tree inside the card — the
sidebar workspace-switcher popup's content laid out as flex cards, three to a row on `lg`.
Clicking an enterable node switches residency (same contract as the popup). Tools stay in the
sidebar nav. Full contract: `.claude/specs/home-app/index.ui.md` + `index.data.md`.

**No new GraphQL operations, no codegen, no DB change, no barrel edits.** Everything renders
from `ProfileClaims.residencies` (localStorage) via existing machinery.

## Verified code anchors

| Anchor | Where | Role |
|---|---|---|
| Current landing page | `apps/home-app/app/pages/index.vue` | Rewrite logged-in view; hero (lines 1–31) + `?session=expired` toast (`onMounted`, ~128–139) stay |
| Switcher modal + tree markup | `packages/tenant-layer/app/components/WorkspaceSwitcher.vue` | Source of the `UTree` body (~126–186), `toItem`, `statusBadge` — extract to `ResidencyTree.vue` |
| Tree derivation + switch | `packages/auth-ui/src/use-residency-switcher.ts` (`roots`, `switchResidency`, `ResidencySwitchNode`) | Consumed unchanged |
| auth-layer re-export | `packages/auth-layer/app/composables/useResidencySwitcher.ts` | Auto-import path for the page (home-app → tenant-layer → auth-layer) |
| Status badge helpers | `packages/auth-layer/app/utils/status.ts` (`statusColor`, `statusLabel`) | Auto-imported in both consumers (UC1) |
| refreshClaims / support flag | `packages/auth-ui/src/use-auth.ts` via `useAuth()` | On-mount refresh; `p:exit-support` → display-only |
| home-app config | `apps/home-app/nuxt.config.ts` | No routeRules today; page stays SSR-safe (claims render client-side, refresh in `onMounted`) — no UC14 change |

## Phases

### Phase 1 — shared tree component (tenant-layer)
- [ ] Create `packages/tenant-layer/app/components/ResidencyTree.vue`: presentational (R2) —
      props `nodes: ResidencySwitchNode[]`, `disabled?: boolean`,
      `switchingTenantId?: string | null`; emits `select(node: ResidencySwitchNode)` only for
      `canEnter && residentId !== null` nodes. Move the `UTree` + `toItem` + `statusBadge` +
      item-label/item-trailing slots over verbatim (icons `i-lucide-network`/`i-lucide-building-2`,
      `defaultExpanded`, Current badge, status badge, ghost lock, spinner).
- [ ] Refactor `WorkspaceSwitcher.vue`: modal body renders
      `<ResidencyTree :nodes="items-source roots" :disabled="switching" :switching-tenant-id="switchingTenantId" @select="onNodeSelect" />`;
      trigger, on-open `refreshClaims`, `onNodeSelect` switch call, toasts, skeletons,
      `UProgress` all stay in the switcher. No behavior change.

### Phase 2 — landing page (home-app)
- [ ] `apps/home-app/app/pages/index.vue` logged-in view: drop the module grid, accent cycling,
      chip derivations, and `useAppNav` usage; subheading → `your workspaces`. Keep greeting +
      hero + session-expired toast.
- [ ] Cards: `flex flex-wrap items-start` container; per root node one `UCard` (UC4) with
      `basis-full sm:basis-[calc(50%-0.5rem)] lg:basis-[calc(33.333%-0.75rem)]` (UC5, 3-up on
      big screens). Header = the root tenant node (icon, truncated name, Current/status badge,
      ghost lock, clickable when enterable, spinner while switching); body =
      `<ResidencyTree :nodes="node.children" …/>`, omitted when childless. Page width shell
      widens to `max-w-5xl mx-auto` (UC12 hub).
- [ ] States: on-mount `refreshClaims()` (`refreshing` → thin `UProgress`, failure toast
      `Could not refresh workspaces`); `roots.length === 0` → `USkeleton` cards while
      refreshing, else `UEmpty` (`i-lucide-building-2`, `no workspaces yet`) (UC8);
      support mode (`p:exit-support`) → everything display-only, tooltip
      `Exit support to switch`.
- [ ] Switch flow owned by the page (R2): `select` → `switchResidency(node.residentId)`;
      `switching`/`switchingTenantId` state; failure → toast `Failed to switch workspace`
      (UC7) + clear in-flight state. Full reload on success ends the interaction.

### Phase 3 — verify + spec upkeep
- [ ] `pnpm build` gate green (repo-wide lint is known-broken; build is the gate).
- [ ] Read-only visual verification at mobile/`sm`/`lg` widths; sidebar switcher modal still
      switches (normal + ghost + support cases). **Ask the user** before any env restart —
      tenant-layer edits don't hot-reload in Docker.
- [ ] Spec upkeep: `.claude/specs/home-app/README.md` status → Implemented + boxes checked
      (+ corrections section if code diverged); fold the pending-refactor note in
      `.claude/specs/workspace-switcher/switcher.ui.md` into its Modal section.
- [ ] Hand-off question: move this plan to `addressed/`? (yes/no — never auto-move).

## Out of scope
- Any DB/nav-registration change (R14 rows untouched — the sidebar keeps rendering tools).
- `useAppNav` itself (still consumed by `AppNav`/`AppNavMobile`).
- The hero (logged-out) view and the claims-delivery machinery (workspace-switcher spec).
