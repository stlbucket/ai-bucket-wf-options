# nav-collapsible-sections — Individually Collapsible Left-Nav Sections

> **Execution Directive:** plan + build this spec via
> `/fnb-stack-implementor .claude/specs/nav-collapsible-sections/README.md` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
Implemented — 2026-07-23. Decisions locked 2026-07-23 (persist per-section to localStorage ·
active-section auto-expands · desktop + mobile). Built via
`0020__app_______nav-collapsible-sections________LOW__.plan.md`; `pnpm build` green; verified in
the running UI by the user. No divergence from the spec — `UCollapsible` (Nuxt UI 4.6.1) carried
the disclosure as designed; the fallback was not needed.

## Purpose

The tenant-layer left sidebar renders one nav **section** per module (`ModuleNavSection`), each a
static uppercase header followed by its tool links. Today every section is always fully expanded,
so a user with many modules gets a long, unscannable rail. This change makes each section header a
**disclosure toggle** — click to collapse/expand that section's links — and picks a sensible
default: the **top 3 sections open, the rest collapsed** on first visit.

Scope is purely the tenant-layer nav **components + client state** — no DB, no GraphQL, no new
types. The section data itself is unchanged: it still comes from `ProfileClaims.modules` via
`useAppNav().availableSections`, already sorted **descending by `ordinal`** (so "top 3" = the
first three rendered).

This composes with, and is orthogonal to, the existing **whole-nav** collapse (`navCollapsed`,
the `w-16` icon rail). Per-section collapse only applies while the nav is expanded; in icon-rail
mode there are no section headers (items render as tooltip'd icons) and nothing changes.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Default open set | **Top 3 sections open, rest collapsed** — `index < 3` in the already-`ordinal`-desc `availableSections` order | User directive. First three highest-ordinal modules are the most-used; keeps the rail short by default. Fewer than 3 sections → all open. |
| Active-section override | The section containing the current route is **open by default even if below the top 3** — default predicate is `index < 3 || sectionContainsActiveRoute` | User choice (2026-07-23). Prevents the active page being hidden inside a collapsed group on load. |
| Persistence | **Per-section**, to `localStorage` key `fnb:nav-section:<sectionKey>` = `'1'|'0'`, read in `onMounted` | User choice. Mirrors the existing `navCollapsed` pattern (`fnb:nav-collapsed`, read post-mount to avoid a hydration mismatch). A stored value **overrides** the default for that section. |
| Precedence | Stored value (if any) wins over the computed default (incl. the active-section override) | Respect explicit user intent. Consequence — a section the user manually collapsed stays collapsed even when it holds the active route; see Remaining Open Questions. |
| Scope of behavior | **Both** desktop sidebar (`AppNav`) and mobile drawer (`AppNavMobile`) — they share `ModuleNavSection` | User choice. Consistent behavior; cheapest (no opt-out prop). |
| State home | Section open-state + persistence live in `useAppNav()` (`useState` override map + `isSectionOpen`/`setSectionOpen`), not prop-drilled | `navCollapsed`/`availableSections` already live there; both `AppNav` and `AppNavMobile` (and `ModuleNavSection` itself) consume the composable directly. Keeps one source of truth so desktop + drawer stay in sync. |
| Disclosure mechanism | `UCollapsible` with `v-model:open` bound to the composable (header = trigger/default slot, links = `#content` slot) | UC3 (Nuxt UI before raw HTML/CSS) — accessible disclosure + open/close animation for free. Fallback if unavailable in the installed version: `<button>` + `v-show` with a CSS height/opacity transition. |
| Header affordance | Header becomes a full-width `<button>` (`justify-between`), label left, `i-lucide-chevron-down` right, rotated `-rotate-90` when closed | Standard disclosure affordance; keeps the existing mono/uppercase/tracking header styling (UC11 — `chevron-down` is a valid lucide name). |
| SSR / hydration | SSR + first client render use the **computed default** (no `localStorage`); `onMounted` then merges stored overrides | Same contract as `navCollapsed`. `index` and route are known SSR, so the default renders deterministically; stored prefs apply as a post-hydration update. |
| Icon-rail interplay | When `navCollapsed` (whole nav = icon rail), section collapse is **not** shown — unchanged icon-only rendering | Headers/disclosure only exist in the expanded (`!collapsed`) branch of `ModuleNavSection`. |

## Files in this spec

| File | Covers |
|---|---|
| `README.md` | This index |
| `nav.data.md` | `useAppNav` client-state extension: override map, `isSectionOpen`/`setSectionOpen`, default predicate, `localStorage` persistence + `onMounted` hydration |
| `nav.ui.md` | `ModuleNavSection` disclosure UI (`UCollapsible`, chevron header button), `AppNav`/`AppNavMobile` hydration wiring, interactions |

## Implementation Task List

### Phase 1 — client state (`useAppNav.ts`)
- [x] Add a `useState<Record<string, boolean>>('nav-section-overrides', () => ({}))` override map
- [x] Add `defaultSectionOpen(key)` — resolves the section's index in `availableSections` and its
      active-route membership → `index < 3 || sectionContainsActiveRoute` (uses `useRoute()`)
- [x] Add `isSectionOpen(key)` — `overrides[key] ?? defaultSectionOpen(key)`
- [x] Add `setSectionOpen(key, value)` — set the override + write
      `localStorage['fnb:nav-section:' + key]` (client only, `import.meta.client`)
- [x] Add `hydrateSectionState()` — read stored `'1'|'0'` values for every `availableSections`
      key into the override map; idempotent (safe to call from both nav components)
- [x] Export the new members alongside the existing `navCollapsed`/`toggleCollapsed` surface

### Phase 2 — section UI (`ModuleNavSection.vue`)
- [x] Consume `useAppNav()` for `isSectionOpen`/`setSectionOpen`; writable `open` computed for
      `section.key`
- [x] Wrap the **expanded** (`!collapsed`) branch in `UCollapsible` (`v-model:open`); header
      `<button>` (label + rotating `i-lucide-chevron-down`) as trigger, links as `#content`
- [x] Leave the `collapsed` (icon-rail) branch untouched
- [x] Verify `UCollapsible` exists in the installed Nuxt UI version — confirmed in `@nuxt/ui`
      4.6.1 (`v-model:open`, default slot = trigger, `#content`); fallback not needed

### Phase 3 — hydration wiring
- [x] `AppNav.vue`: call `hydrateSectionState()` in `onMounted` (next to the existing
      `NAV_COLLAPSED_KEY` read)
- [x] `AppNavMobile.vue`: call `hydrateSectionState()` in `onMounted` (drawer shares the state)

### Phase 4 — verify + spec upkeep
- [x] Layer edits don't hot-reload — user rebuilt; `pnpm build` gate green; nav verified in the
      running UI by the user (collapse/expand + persistence + active-section + icon-rail + mobile)
- [x] README status → Implemented; boxes checked; no divergence to record

## Remaining Open Questions
- **Manually-collapsed active section stays collapsed** — stored preference wins over the
  active-section default (Precedence, above). If usage shows this hides the active page too often,
  switch active-section to a hard override (always open, ignoring the stored value) — at the cost
  of the current section's toggle snapping back open.
- **No "expand/collapse all" control** — not requested; add a header affordance later if wanted.
- **Override entries for removed modules** persist in `localStorage` — harmless (ignored when the
  key isn't in `availableSections`); no cleanup planned.

## Considered & rejected
- **Prop-drilling open-state from `AppNav`/`AppNavMobile` into `ModuleNavSection`** — desktop and
  drawer would each need their own state plumbing and could drift; the composable already owns
  `navCollapsed`/`availableSections`, so section state belongs there too.
- **Single "which one section is open" accordion** — the directive is top-3-open (multiple), not a
  one-at-a-time accordion; independent per-section booleans match the ask.
- **Session-only (no persistence) reset-to-top-3 each load** — offered; user chose persistence so
  a deliberately-opened section survives reloads.
- **Persisting the whole open-set as one JSON blob** — per-key `'1'|'0'` mirrors the existing
  `navCollapsed` storage shape and needs no parse/serialize error handling.
- **Raw `<div>` + manual height animation** — `UCollapsible` gives accessible disclosure +
  animation per UC3; hand-rolled CSS is only the fallback if the component is unavailable.
