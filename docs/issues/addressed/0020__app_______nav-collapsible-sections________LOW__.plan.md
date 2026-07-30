# Plan: Left-nav — individually collapsible sections (top 3 open by default)

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/nav-collapsible-sections/` (README + `nav.data.md` +
> `nav.ui.md`) — this plan sequences it and records verified code anchors; it does not restate
> the spec (R21). Frontend-only: no DB, no GraphQL, no `fnb-types`, **no env rebuild and no new
> dependencies**. Never run `git`; layer edits don't hot-reload, so ask the user to restart the
> tenant-layer apps for the end-to-end check (memory `feedback_rebuild_ask_user`,
> `project_layer_changes_need_restart`).

**Severity: LOW** (UI enhancement) · Workstream: tenant-layer nav · Planned: 2026-07-23
· Spec status: Draft, no `[FILL IN]`s; all three design decisions locked 2026-07-23
(persist per-section to localStorage · active-section auto-expands · applies to desktop + mobile).

## Context

The tenant-layer left sidebar renders one section per module via `ModuleNavSection.vue`, driven by
`useAppNav().availableSections` (from `ProfileClaims.modules`, already **sorted `ordinal` DESC** →
"top 3" = the first three rendered). Today the section header is a static `<div>` and every section
is always expanded. This change makes each header a **disclosure toggle** (`UCollapsible`), defaults
to **top 3 open + the active section open, rest collapsed**, and persists each section's state to
`localStorage` (`fnb:nav-section:<key>`), mirroring the existing `navCollapsed` pattern.

Scope is entirely `packages/tenant-layer` — one composable + one component changed, plus a one-line
`onMounted` hydrate call in each of the two nav shells. This composes with, and is orthogonal to,
the whole-nav `navCollapsed` icon rail (per-section collapse only shows while the nav is expanded).

## Verified code anchors (2026-07-23)

- Composable: `packages/tenant-layer/app/composables/useAppNav.ts` — `navCollapsed` `useState`
  `:26`; `availableSections` computed (modules → `NavSection[]`, `.sort` `ordinal` DESC) `:28-45`;
  returned surface `:47-55`. `NavItem.route` + `NavSection.key`/`.items` types `:6-21`. Add the
  override map + `defaultSectionOpen`/`isSectionOpen`/`setSectionOpen`/`hydrateSectionState` here
  and to the return object.
- Section component: `packages/tenant-layer/app/components/ModuleNavSection.vue` — props
  `{ section, collapsed }` `:5`; local `isActive` `:11-13`; **icon-rail branch**
  `<template v-if="collapsed">` `:25-46` (leave untouched); **expanded branch**
  `<template v-else>` `:48-64` (header `<div>` `:18-23` currently outside the branches — see note)
  → wrap in `UCollapsible`. The static header `<div>` at `:18-23` (`v-if="!collapsed"`) becomes the
  `UCollapsible` trigger button; the `v-for` links `:49-63` move into `#content`.
- Desktop shell: `packages/tenant-layer/app/components/AppNav.vue` — existing `onMounted` reads
  `NAV_COLLAPSED_KEY` `:23-25`; add `hydrateSectionState()` there. Renders
  `<ModuleNavSection v-for … :collapsed="navCollapsed">` `:52-57` (unchanged).
- Mobile shell: `packages/tenant-layer/app/components/AppNavMobile.vue` — **no `onMounted` today**;
  add one calling `hydrateSectionState()`. Renders `<ModuleNavSection v-for>` in the drawer `:96`
  (no `:collapsed` → expanded form; unchanged).
- `UCollapsible` **confirmed in `@nuxt/ui` 4.6.1** (`dist/runtime/components/Collapsible.vue`):
  `v-model:open` (`open` prop + `update:open` emit), **default slot is the trigger**
  (`CollapsibleTrigger as-child`, exposes `{ open }`) — so a single-root `<button>` in the default
  slot becomes the toggle with **no `@click` needed**; `#content` slot holds the links; `:ui` has a
  `content` key for styling. `unmountOnHide` defaults true (fine — nav links hold no state).
- No dep changes: `packages/tenant-layer/package.json` already declares `@nuxt/ui: "catalog:"`.
- `import.meta.client` is the SSR guard for the localStorage reads/writes (no prior use in
  tenant-layer, but standard Nuxt; `AppNav.vue` already does the equivalent inside `onMounted`).
- Icon: `i-lucide-chevron-down` (UC11 — valid lucide name; rotate `-rotate-90` when closed).

## Implementation phases

Follows the spec README task list. **`pnpm build` is the gate** (repo lint broken — memory
`project_eslint_broken`). Snippets are verbatim in `nav.data.md` / `nav.ui.md`; do not improvise.

### Phase 1 — client state (`useAppNav.ts`) — `nav.data.md`
1. Import `useRoute` (`nuxt/app`); add `const route = useRoute()`.
2. Add `sectionOverrides = useState<Record<string, boolean>>('nav-section-overrides', () => ({}))`
   and `const SECTION_KEY_PREFIX = 'fnb:nav-section:'`.
3. Add helpers per the spec: `sectionContainsActiveRoute(section)`, `defaultSectionOpen(key)`
   (`index < 3 || sectionContainsActiveRoute`, SSR-safe — no localStorage), `isSectionOpen(key)`
   (`overrides[key] ?? default`), `setSectionOpen(key, value)` (override + `localStorage.setItem`
   guarded by `import.meta.client`), `hydrateSectionState()` (client-only; merge stored `'1'|'0'`
   for every `availableSections` key; idempotent).
4. Add `isSectionOpen`, `setSectionOpen`, `hydrateSectionState` to the returned object (keep all
   existing members).

### Phase 2 — section UI (`ModuleNavSection.vue`) — `nav.ui.md`
1. Script: import `useAppNav` + `NavSection` type; capture props to a `props` const; pull
   `isSectionOpen`/`setSectionOpen`; add writable `open = computed({ get, set })` keyed on
   `props.section.key`. Keep local `isActive`.
2. Leave the outer wrapper `<div>` and the `collapsed` (icon-rail) `<template v-if="collapsed">`
   branch exactly as-is.
3. Rewrite the expanded branch: `<UCollapsible v-model:open="open" :ui="{ content: 'flex flex-col gap-0.5' }">`
   → default-slot `<button type="button">` header (label left + rotating `i-lucide-chevron-down`
   right, `justify-between`, keeping the existing mono/uppercase/tracking/`text-white/45` style +
   `hover:text-white/70`; **no `@click`** — the slot is the trigger) → `<template #content>` with the
   existing `v-for` `NuxtLink` links unchanged.

### Phase 3 — hydration wiring — `nav.ui.md`
1. `AppNav.vue`: pull `hydrateSectionState` from `useAppNav()`; call it inside the existing
   `onMounted` after the `NAV_COLLAPSED_KEY` read.
2. `AppNavMobile.vue`: import `onMounted` (`vue`); pull `hydrateSectionState`; add
   `onMounted(() => hydrateSectionState())`.

### Phase 4 — verify + spec reconcile
1. Root `pnpm build` green (typecheck gate).
2. Ask the user to restart the tenant-layer apps (`docker compose restart` — layer edits don't
   hot-reload). Then drive read-only: with ≥4 modules, only the top 3 sections open on first load;
   collapse/expand a section + reload → state persists; navigate into a below-top-3 section →
   it's open (active-section rule); toggle the whole nav to the icon rail → headers/disclosure
   disappear, re-expand restores per-section state; confirm the mobile drawer behaves the same.
3. Flip the three spec Status lines to `Implemented`, retro-check the README task list, add a
   corrections note if code diverged. Add the `ModuleNavSection`/`useAppNav` collapsibility to
   `package-layers-pattern.md`'s tenant-layer inventory if it warrants a line (R21 hygiene).
4. Ask the user before moving this plan to `addressed/` (memory
   `feedback_ask_before_moving_addressed`).

## Sequencing summary

1. Phase 1 (composable) → Phase 2 (component, depends on the new composable members) → Phase 3
   (shells call `hydrateSectionState`) → `pnpm build` → **user restarts tenant-layer apps** →
   Phase 4 verify → spec reconcile → sign-off.
2. One user touchpoint mid-flight: the tenant-layer app restart before the end-to-end check.

## Out of scope / linked (recorded in the spec README)

- Manually-collapsed active section stays collapsed (stored pref wins) — revisit to a hard
  always-open override only if usage shows it hides the active page too often.
- No "expand/collapse all" control; no cleanup of stale override keys for removed modules
  (harmless — ignored when not in `availableSections`).
- `UCollapsible`-unavailable fallback (`<button>` + `v-show` + CSS transition) is documented in the
  spec but **not needed** — 4.6.1 ships the component.
