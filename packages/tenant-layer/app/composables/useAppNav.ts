import { useAuth } from "@function-bucket/fnb-auth-layer/app/composables/useAuth"
import type { ModuleInfo, ToolInfo } from '@function-bucket/fnb-types'
import { useRoute, useState } from "nuxt/app"
import { computed } from "vue"

export interface NavItem {
  key: string
  label: string
  icon: string
  route: string
  ordinal: number
}

export interface NavSection {
  key: string
  permissions: string[]
  label: string
  icon: string
  ordinal: number
  items: NavItem[]
}

// localStorage key prefix for per-section open/collapsed state (mirrors the whole-nav
// `fnb:nav-collapsed` pattern). Value is '1' (open) | '0' (collapsed).
const SECTION_KEY_PREFIX = 'fnb:nav-section:'

export function useAppNav() {
  const { user } = useAuth()
  const route = useRoute()
  const navOpen = useState('nav-open', () => false)
  const navCollapsed = useState('nav-collapsed', () => false)

  // Per-section open overrides. Empty entry = "use the computed default". Populated from
  // localStorage in onMounted via hydrateSectionState() (client only, to avoid a hydration
  // mismatch — SSR + first client render use the default, exactly like navCollapsed).
  const sectionOverrides = useState<Record<string, boolean>>('nav-section-overrides', () => ({}))

  const availableSections = computed(() => {
    const modules = user.value?.modules
    if (!modules?.length) return []
    return modules.map((m: ModuleInfo) => ({
      key: m.key ?? '',
      label: m.name ?? '',
      icon: m.defaultIconKey ?? '',
      ordinal: m.ordinal ?? 0,
      permissions: m.permissionKeys ?? [],
      items: (m.tools ?? []).map((t: ToolInfo) => ({
        key: t.key ?? '',
        label: t.name ?? '',
        icon: t.defaultIconKey ?? '',
        route: t.route ?? '',
        ordinal: t.ordinal ?? 0,
      })),
    })).sort((a, b) => (b.ordinal ?? 0) - (a.ordinal ?? 0))
  })

  function sectionContainsActiveRoute(section: NavSection): boolean {
    return section.items.some(
      (i) => route.path === i.route || route.path.startsWith(i.route + '/'),
    )
  }

  // SSR-safe default (no localStorage): the top 3 sections (already ordinal-desc) are open,
  // plus whichever section holds the active route.
  function defaultSectionOpen(key: string): boolean {
    const sections = availableSections.value
    const idx = sections.findIndex((s) => s.key === key)
    if (idx === -1) return false
    return idx < 3 || sectionContainsActiveRoute(sections[idx]!)
  }

  // A stored preference wins over the computed default.
  function isSectionOpen(key: string): boolean {
    return sectionOverrides.value[key] ?? defaultSectionOpen(key)
  }

  function setSectionOpen(key: string, value: boolean) {
    sectionOverrides.value = { ...sectionOverrides.value, [key]: value }
    if (import.meta.client) {
      localStorage.setItem(SECTION_KEY_PREFIX + key, value ? '1' : '0')
    }
  }

  // Read persisted values for the current sections into the override map. Client-only and
  // idempotent — safe to call from both AppNav and AppNavMobile onMounted.
  function hydrateSectionState() {
    if (!import.meta.client) return
    const next: Record<string, boolean> = { ...sectionOverrides.value }
    for (const s of availableSections.value) {
      const raw = localStorage.getItem(SECTION_KEY_PREFIX + s.key)
      if (raw === '1' || raw === '0') next[s.key] = raw === '1'
    }
    sectionOverrides.value = next
  }

  return {
    navOpen,
    navCollapsed,
    availableSections,
    openNav: () => { navOpen.value = true },
    closeNav: () => { navOpen.value = false },
    toggleNav: () => { navOpen.value = !navOpen.value },
    toggleCollapsed: () => { navCollapsed.value = !navCollapsed.value },
    isSectionOpen,
    setSectionOpen,
    hydrateSectionState,
  }
}
