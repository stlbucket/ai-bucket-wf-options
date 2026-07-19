# Handoff: Home Dashboard — Tools Grouped by Module

## Overview
Redesign of the **logged-in dashboard** in `apps/home-app/app/pages/index.vue` (repo `stlbucket/ai-bucket`, branch `file-upload`). The current dashboard flattens every granted tool into one grid (`availableSections.value.flatMap(s => s.items)`). This design keeps the same card treatment but **groups the cards by module (nav section)**, with a labeled section header per module. Visuals follow the existing "Cascadia" redesign direction (see `.claude/design-implementations/design_handoff_function_bucket_redesign/`).

## About the Design Files
`Dashboard Grouped by Module.dc.html` is a **design reference created in HTML** — a prototype showing intended look and behavior, **not production code to copy**. Recreate it in the existing Nuxt 4 / Nuxt UI v4 / Tailwind codebase using its established patterns (NuxtLink cards, UIcon, `useAppNav`). The sidebar shown in the mock is context only — it already exists (`packages/tenant-layer/app/components/AppNav.vue`) and needs no changes.

## Fidelity
**High-fidelity** for the content area. Colors, typography, spacing, and copy are intentional.

## Scope of change
One file: `apps/home-app/app/pages/index.vue`, logged-in branch only.

Replace:
```ts
const tools = computed(() => availableSections.value.flatMap((s) => s.items))
```
with iteration over `availableSections` directly — one `<section>` per module (module `label`, `icon`, and its `items`), preserving each section's ordinal sort from `useAppNav`.

**Accent color decision:** keep the existing cycled accents — one global index across ALL cards in page order, cycling `['var(--ui-primary)', 'var(--ui-secondary)', 'var(--ui-warning)']` (blue/green/warn) exactly as the current code does. The counter does NOT reset per module.

**Placeholder card decision:** the dashed "+ more tools as granted" card is **removed** in this design (the current code renders it at the end of the flat grid — drop it). Keep the existing `UEmpty` state for zero modules.

## Layout
Content area (unchanged context: page bg `--paper-alt`, content padding 44px 48px, max-width 1040px centered):

1. **Greeting block** (unchanged from current): `hey, {firstName}.` — JetBrains Mono 28px/700, letter-spacing -0.02em; below it "here's what's in your bucket" 14px `--ink-soft`, 6px gap.
2. **Module sections**, stacked with 36px vertical gap. Each section is a column with 14px gap:
   - **Module header row** — flex, align center, 10px gap:
     - Module icon, 15px, colored with the module's *first* accent color in that section (in the mock: uses the section accent; with cycled accents, use the accent of the section's first card).
     - Module label — JetBrains Mono 11px/700, uppercase, letter-spacing 0.08em, color `--ink-soft` (`oklch(0.50 0.012 250)`).
     - Tool count — JetBrains Mono 11px/600, zero-padded ("03"), color `--ink-faint` (`oklch(0.66 0.010 250)`).
     - Hairline rule filling remaining width — 1px, `--line` (`oklch(0.90 0.008 250)`).
   - **Card grid** — `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, 16px gap. In Tailwind terms the existing `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` is an acceptable equivalent.

## Components

### Tool card (same as current, values confirmed)
- `<NuxtLink :to="item.route" :external="true">`
- Column flex, 10px gap, padding 20px
- Background `--paper` (`oklch(0.99 0.003 250)`); border 1px `--line`; **border-top 3px solid {accent}**; radius 10px
- Icon: 22px, colored {accent} (`UIcon :name="item.icon"`)
- Title: 15px/600 (`item.label`)
- Action line: 13px `--ink-soft` — `Open {label.toLowerCase()} →`
- Hover: `box-shadow: 0 4px 14px oklch(0 0 0 / 0.07)`, 150ms transition (current code uses `hover:shadow-sm` — either is fine)

### Module header icons
The mock uses wrench (Tools) and shield (Admin) as placeholders. In the codebase, use the module's real `defaultIconKey` from `useAppNav` (`s.icon`), rendered via `UIcon` at ~15px.

## Interactions & Behavior
- Cards navigate to `item.route` (external), unchanged.
- No new state; `availableSections` from `useAppNav` already provides the grouped shape.
- Empty state unchanged (`UEmpty` with `i-lucide-package-open`).
- Responsive: grid collapses per the existing sm/lg breakpoints; section headers stay full-width.

## Design Tokens (Cascadia, already established)
- `--blue: oklch(0.42 0.11 248)` → `var(--ui-primary)`
- `--green: oklch(0.48 0.11 155)` → `var(--ui-secondary)`
- `--warn: oklch(0.68 0.13 75)` → `var(--ui-warning)`
- `--ink: oklch(0.24 0.012 250)`; `--ink-soft: oklch(0.50 0.012 250)`; `--ink-faint: oklch(0.66 0.010 250)`
- `--paper: oklch(0.99 0.003 250)`; `--paper-alt: oklch(0.965 0.006 250)`; `--line: oklch(0.90 0.008 250)`
- Mono: JetBrains Mono 500/600/700 (Google Fonts, already in the design system)
- Radii: cards 10px

Dark mode: not mocked here; apply the existing Cascadia dark token set via the color-mode module as elsewhere.

## Assets
- Icons: Lucide via `UIcon` (`i-lucide-*`) — the mock inlines equivalent stroke SVGs; use the real icon keys from the nav data.
- Bucket logo: existing `FunctionBucketMark.vue` (sidebar context only, unchanged).
- All names/data in the mock are placeholders.

## Files
- `Dashboard Grouped by Module.dc.html` — the design; open in a browser. Includes two toggles used during review (accent mode, placeholder card); the decisions above (cycled accents, no placeholder) are final.
- `support.js` — mock runtime, not part of the design.
