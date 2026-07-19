# Handoff: Home Dashboard — Simple Lists + Tenant/Workspace Context

## Overview
Redesign of the **logged-in dashboard** in `apps/home-app/app/pages/index.vue` (repo `stlbucket/ai-bucket`). Two changes from the current implementation:

1. **Tool cards are removed** — replaced with simple icon + label list rows, grouped by module (nav section) with a labeled header per module.
2. **Tenant and workspace names are displayed** — as two chips under the greeting.

Visuals stay within the established "Cascadia" direction (see `.claude/design-implementations/design_handoff_function_bucket_redesign/`).

## About the Design File
`Home Dashboard — Simple Lists.dc.html` is a **design reference created in HTML** — a prototype showing intended look and behavior, **not production code to copy**. Recreate it in the existing Nuxt 4 / Nuxt UI v4 / Tailwind codebase using its established patterns (NuxtLink, UIcon, `useAppNav`, `useAuth`). The sidebar in the mock is context only — it already exists (`packages/tenant-layer/app/components/AppNav.vue`) and needs no changes.

## Fidelity
**High-fidelity** for the content area. Colors, typography, spacing, and copy are intentional.

## Scope of change
One file: `apps/home-app/app/pages/index.vue`, logged-in branch only.

- Drop the flat card grid, the cycled `borderTopColor` card treatment, and the dashed "+ more tools as granted" placeholder card.
- Iterate over `availableSections` from `useAppNav()` directly — one `<section>` per module, preserving each section's ordinal sort.
- Keep the existing `UEmpty` state for zero modules, the greeting block, and the session-expired toast logic unchanged.

## Data sources
- **Modules/tools:** `useAppNav().availableSections` — module `label`, `icon` (`defaultIconKey`), and `items` (each with `label`, `icon`, `route`).
- **Tenant name:** `useAuth().user.tenantName` (from `ProfileClaims`; null when no tenant selected — hide the chip row or show `—`).
- **Workspace name:** the current workspace residency — derive from the residency the user currently occupies (`user.residentId` matched against `user.residencies`, per `use-residency-switcher.ts`). If the current tenant IS the workspace, show parent tenant name in the first chip and current tenant name in the second. Hide the second chip (and the `/` separator) when there is no workspace context.
- Names in the mock (`acme corp`, `west region`) are placeholders.

## Layout
Content area (page bg `--paper-alt`, content padding 44px 48px). **Max-width tightens from 1040px to 760px** — lists don't need card-grid width.

1. **Greeting block** (unchanged): `hey, {firstName}.` — JetBrains Mono 28px/700, letter-spacing -0.02em; below it "here's what's in your bucket" 14px `--ink-soft`, 6px gap.
2. **Context chip row** — 14px below the greeting block; flex, 8px gap, wraps:
   - **Tenant chip** — inline-flex, 7px gap, padding 5px 10px, radius 6px; JetBrains Mono 12px/600; color `--blue`; bg `--blue` at 8% alpha; border 1px `--blue` at 18% alpha; 13px building icon (`i-lucide-building-2`).
   - **Separator** — `/`, JetBrains Mono 12px, `--ink-faint`.
   - **Workspace chip** — same treatment in `--green`; 13px layers icon (`i-lucide-layers`).
3. **Module sections** — CSS grid, `repeat(auto-fit, minmax(300px, 1fr))`, gap 36px 48px, `align-items:start` (two side-by-side columns at desktop width; single column narrow). Each section is a column with 6px gap:
   - **Module header row** — flex, align center, 10px gap, 8px bottom padding:
     - Module icon, 15px, colored with the section's accent (`UIcon`, `s.icon`).
     - Module label — JetBrains Mono 11px/700, uppercase, letter-spacing 0.08em, `--ink-soft`.
     - Tool count — JetBrains Mono 11px/600, zero-padded ("03"), `--ink-faint`.
     - Hairline rule filling remaining width — 1px, `--line`.
   - **Tool rows** (see component below).

## Components

### Tool row (replaces the tool card)
- `<NuxtLink :to="item.route" :external="true">`
- Row flex, align center, 12px gap; padding 10px; **negative horizontal margin -10px** so the hover surface outdents while text stays aligned with the header; radius 8px.
- Icon: 18px, colored {accent} (`UIcon :name="item.icon"`), flex-shrink 0.
- Label: 15px/500, `--ink`.
- Trailing `→`: 13px, `--ink-faint`, pushed right with `margin-left:auto`.
- Row divider: border-bottom 1px `oklch(0.93 0.006 250)` (between `--line` and `--paper-alt`).
- Hover: background `--paper`.

**Accent color decision:** keep the existing cycled accents — one global index across ALL rows in page order, cycling `['var(--ui-primary)', 'var(--ui-secondary)', 'var(--ui-warning)']`. The counter does NOT reset per module. Applies to row icons; the module header icon uses the module's fixed accent (Tools = primary, Admin = secondary).

## Interactions & Behavior
- Rows navigate to `item.route` (external), unchanged from cards.
- Chips are display-only in this design (the residency switcher already lives elsewhere); no click behavior.
- No new state.
- Empty state unchanged (`UEmpty` with `i-lucide-package-open`).
- Responsive: section grid collapses to one column below ~650px content width; chip row wraps.

## Design Tokens (Cascadia, already established)
- `--blue: oklch(0.42 0.11 248)` → `var(--ui-primary)`
- `--green: oklch(0.48 0.11 155)` → `var(--ui-secondary)`
- `--warn: oklch(0.68 0.13 75)` → `var(--ui-warning)`
- `--ink: oklch(0.24 0.012 250)`; `--ink-soft: oklch(0.50 0.012 250)`; `--ink-faint: oklch(0.66 0.010 250)`
- `--paper: oklch(0.99 0.003 250)`; `--paper-alt: oklch(0.965 0.006 250)`; `--line: oklch(0.90 0.008 250)`
- Mono: JetBrains Mono 500/600/700 (already in the design system)

Dark mode: not mocked; apply the existing Cascadia dark token set via the color-mode module as elsewhere. Chip alpha backgrounds (8% fill / 18% border) should read against the dark paper equivalents.

## Design-file Tweaks (review toggles, with final decisions)
- `twoColumns` — **final: true** (auto-fit grid; collapses naturally when narrow).
- `showDividers` — **final: true** (hairline between rows).
- `tenantName` / `workspaceName` — placeholder text only.

## Assets
- Icons: Lucide via `UIcon` (`i-lucide-*`) — the mock inlines equivalent stroke SVGs; use the real icon keys from the nav data.
- Bucket logo: existing `FunctionBucketMark.vue` (sidebar context only, unchanged).

## Files
- `Home Dashboard — Simple Lists.dc.html` — the design; open in a browser.
- `support.js` — mock runtime, not part of the design.
