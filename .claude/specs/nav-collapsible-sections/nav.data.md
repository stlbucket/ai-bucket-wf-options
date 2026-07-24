# nav-collapsible-sections — Client State (`useAppNav`)

## Status
Implemented — 2026-07-23. Client-state-only contract (no DB, no GraphQL, no `fnb-types`).

## Overview

There is **no data layer** to this feature — sections still come from `ProfileClaims.modules` via
the existing `useAppNav().availableSections` computed (unchanged). The only new state is the
per-section open/closed booleans, owned by `useAppNav()` and persisted to `localStorage`.

File: `packages/tenant-layer/app/composables/useAppNav.ts`

## Existing state (unchanged, for context)

```ts
const navOpen = useState('nav-open', () => false)        // mobile drawer open
const navCollapsed = useState('nav-collapsed', () => false) // whole-nav icon rail
const availableSections = computed(() => /* modules → NavSection[], sorted ordinal DESC */)
```

`availableSections` is already ordered highest-`ordinal`-first, so **"top 3" = indices 0,1,2**.
`NavSection.key` (the module key) is the stable identity used for persistence.

## New state + API

Add to `useAppNav()`:

```ts
import { useRoute } from 'nuxt/app'
// ...
const route = useRoute()

// Per-section open overrides. Empty = "use computed default". Populated from localStorage
// in onMounted via hydrateSectionState() (client only, to avoid a hydration mismatch).
const sectionOverrides = useState<Record<string, boolean>>('nav-section-overrides', () => ({}))

const SECTION_KEY_PREFIX = 'fnb:nav-section:'

function sectionContainsActiveRoute(section: NavSection): boolean {
  return section.items.some(
    (i) => route.path === i.route || route.path.startsWith(i.route + '/'),
  )
}

// SSR-safe default — no localStorage. Top 3 (by the ordinal-desc order) open, plus the
// section holding the active route.
function defaultSectionOpen(key: string): boolean {
  const sections = availableSections.value
  const idx = sections.findIndex((s) => s.key === key)
  if (idx === -1) return false
  return idx < 3 || sectionContainsActiveRoute(sections[idx]!)
}

// Stored preference wins over the computed default (README §Precedence).
function isSectionOpen(key: string): boolean {
  return sectionOverrides.value[key] ?? defaultSectionOpen(key)
}

function setSectionOpen(key: string, value: boolean) {
  sectionOverrides.value = { ...sectionOverrides.value, [key]: value }
  if (import.meta.client) {
    localStorage.setItem(SECTION_KEY_PREFIX + key, value ? '1' : '0')
  }
}

// Read persisted values for the current sections into the override map. Idempotent —
// safe to call from both AppNav and AppNavMobile onMounted.
function hydrateSectionState() {
  if (!import.meta.client) return
  const next: Record<string, boolean> = { ...sectionOverrides.value }
  for (const s of availableSections.value) {
    const raw = localStorage.getItem(SECTION_KEY_PREFIX + s.key)
    if (raw === '1' || raw === '0') next[s.key] = raw === '1'
  }
  sectionOverrides.value = next
}
```

Extend the returned object with `isSectionOpen`, `setSectionOpen`, `hydrateSectionState`
(keep every existing member: `navOpen`, `navCollapsed`, `availableSections`, `openNav`,
`closeNav`, `toggleNav`, `toggleCollapsed`).

## Persistence contract

| Key | Value | Written by | Read by |
|---|---|---|---|
| `fnb:nav-section:<sectionKey>` | `'1'` open · `'0'` collapsed | `setSectionOpen` (on toggle) | `hydrateSectionState` (`onMounted`) |

- **SSR + first client render**: `sectionOverrides` is empty → `isSectionOpen` returns
  `defaultSectionOpen` (`index < 3 || active`). Deterministic on the server (index + route are
  known), so no hydration mismatch.
- **Post-mount**: `hydrateSectionState()` merges stored `'1'/'0'` values; sections with a stored
  preference update to it (same post-mount-flip pattern as `navCollapsed`).
- Stored keys for modules no longer in `availableSections` are ignored (never read).

## Hydration wiring (consumers)

Both nav components call `hydrateSectionState()` in `onMounted` (the state is shared via
`useState`, so whichever mounts first hydrates; the call is idempotent):

- `AppNav.vue` — alongside the existing `NAV_COLLAPSED_KEY` `onMounted` read.
- `AppNavMobile.vue` — add an `onMounted` (none today).

`ModuleNavSection.vue` reads/writes via `isSectionOpen`/`setSectionOpen` (see `nav.ui.md`).

## Open Questions
- None outstanding for the data/state contract. Behavioral edge cases (manually-collapsed active
  section; no expand-all control; stale override keys) are tracked in the README.
