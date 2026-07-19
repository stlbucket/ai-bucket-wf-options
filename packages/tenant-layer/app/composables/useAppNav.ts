import { useAuth } from "@function-bucket/fnb-auth-layer/app/composables/useAuth"
import type { ModuleInfo, ToolInfo } from '@function-bucket/fnb-types'
import { useState } from "nuxt/app"
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

export function useAppNav() {
  const { user } = useAuth()
  const navOpen = useState('nav-open', () => false)
  const navCollapsed = useState('nav-collapsed', () => false)

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

  return {
    navOpen,
    navCollapsed,
    availableSections,
    openNav: () => { navOpen.value = true },
    closeNav: () => { navOpen.value = false },
    toggleNav: () => { navOpen.value = !navOpen.value },
    toggleCollapsed: () => { navCollapsed.value = !navCollapsed.value },
  }
}
