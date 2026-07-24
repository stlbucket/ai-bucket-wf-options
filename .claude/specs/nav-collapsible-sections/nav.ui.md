# nav-collapsible-sections — UI

## Status
Implemented — 2026-07-23. Built as specified; `UCollapsible` (Nuxt UI 4.6.1) carried the
disclosure, fallback not needed.

## Components touched

| File | Change |
|---|---|
| `packages/tenant-layer/app/components/ModuleNavSection.vue` | Header becomes a disclosure toggle; expanded links wrapped in `UCollapsible` |
| `packages/tenant-layer/app/components/AppNav.vue` | `onMounted` → also `hydrateSectionState()` |
| `packages/tenant-layer/app/components/AppNavMobile.vue` | add `onMounted` → `hydrateSectionState()` |

No changes to `WorkspaceSwitcher`, the user footer, the mobile bottom-tab bar, or the whole-nav
`navCollapsed` icon rail.

## `ModuleNavSection.vue`

Two rendering branches exist today, keyed on the `collapsed` prop (the **whole-nav** icon rail):

- **`collapsed` (icon rail)** — items render as tooltip'd icons, **no section header**.
  → **Unchanged.** Per-section disclosure does not apply here (there is no header to click).
- **`!collapsed` (expanded)** — a header `<div>` + a vertical list of full link rows.
  → **This branch changes.**

### Script

```ts
import { computed } from 'vue'
import { useRoute } from 'nuxt/app'
import { useAppNav } from '../composables/useAppNav'
import type { NavSection } from '../composables/useAppNav'

const props = defineProps<{ section: NavSection; collapsed?: boolean }>()
const route = useRoute()
const { isSectionOpen, setSectionOpen } = useAppNav()

const open = computed({
  get: () => isSectionOpen(props.section.key),
  set: (v) => setSectionOpen(props.section.key, v),
})

function isActive(itemRoute: string) {
  return route.path === itemRoute || route.path.startsWith(itemRoute + '/')
}
```

### Template — expanded branch

Replace the static header `<div>` + link list with a `UCollapsible`. The header is the trigger
(a full-width `<button>`, keeping the existing mono/uppercase/tracking style, plus a chevron that
rotates when closed); the links move into the `#content` slot.

```vue
<template v-else>
  <UCollapsible v-model:open="open" :ui="{ content: 'flex flex-col gap-0.5' }">
    <button
      type="button"
      class="flex w-full items-center justify-between rounded-lg px-2.5 pt-2 pb-1
             font-mono text-[11px] font-semibold uppercase tracking-wider
             text-white/45 hover:text-white/70"
    >
      <span>{{ section.label }}</span>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-3.5 shrink-0 transition-transform duration-150"
        :class="open ? '' : '-rotate-90'"
      />
    </button>

    <template #content>
      <NuxtLink
        v-for="item in section.items"
        :key="item.key"
        :to="item.route"
        :external="true"
        class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors"
        :class="
          isActive(item.route)
            ? 'bg-white/15 font-semibold text-white'
            : 'text-white/85 hover:bg-white/8'
        "
      >
        <UIcon :name="item.icon" class="size-4 shrink-0" />
        {{ item.label }}
      </NuxtLink>
    </template>
  </UCollapsible>
</template>
```

Notes:
- Keep the outer `<div class="flex flex-col gap-0.5">` wrapper and the `collapsed` (icon-rail)
  `<template v-if="collapsed">` branch exactly as they are.
- `UIcon`/`NuxtLink`/`UCollapsible` are auto-imported (Nuxt UI + Nuxt); no new imports beyond the
  script block above.
- **`UCollapsible` availability**: verify it exists in the installed Nuxt UI version (the repo
  confirmed `UTree` at 4.6.1). If absent, fall back to a plain `<button>` toggling a `v-show`ed
  link list with a CSS `max-height`/opacity transition — same markup, no Nuxt UI disclosure.

### Status badge colors / reactive state
- New reactive state: `open` (writable computed, per section) — see `nav.data.md`.
- No status badges in this component.

## `AppNav.vue` / `AppNavMobile.vue`

Only the hydration call is added (see `nav.data.md` for `hydrateSectionState`):

```ts
// AppNav.vue — existing onMounted gains the section hydrate
onMounted(() => {
  navCollapsed.value = localStorage.getItem(NAV_COLLAPSED_KEY) === '1'
  hydrateSectionState()
})
```

```ts
// AppNavMobile.vue — add (no onMounted today); pull hydrateSectionState from useAppNav()
onMounted(() => hydrateSectionState())
```

The `<ModuleNavSection v-for … :section :collapsed>` loops in both files are **unchanged** — the
component now sources its open-state from the composable itself.

## Interactions

| Element | Action | Result |
|---|---|---|
| Section header button | Click / Enter / Space | Toggles that section's links; writes `fnb:nav-section:<key>`; chevron rotates. `UCollapsible` handles keyboard + ARIA (`aria-expanded`, controlled region). |
| Section header button | Hover | Header text brightens (`text-white/45` → `text-white/70`). |
| First visit (no stored pref) | Load | Top 3 sections (ordinal-desc order) open; rest collapsed; the section holding the active route also open. |
| Return visit | Load | Each section restores its stored open/collapsed state (post-mount); unstored sections use the default. |
| Whole-nav collapse (`navCollapsed`) | Toggle icon rail | Section headers/disclosure disappear (icon-only rail); on re-expand, sections show their persisted open-state. |

## Responsiveness (UC5)
- Desktop sidebar (`AppNav`, `lg:` and up) and mobile drawer (`AppNavMobile` `USlideover`) both
  render `ModuleNavSection`, so the disclosure works in both without extra work.
- The mobile bottom-tab bar is untouched.

## Known Gaps
- None. (Behavioral edge cases are tracked in the README's Remaining Open Questions.)
