import { computed, type ComputedRef } from 'vue'
import { ENTERABLE_STATUSES } from '@function-bucket/fnb-graphql-client-api'
import type { ResidencyTreeNode } from '@function-bucket/fnb-types'
import { useAuth } from './use-auth'

// Workspace-switcher tree, derived purely from ProfileClaims.residencies in localStorage (the
// useAppNav-from-claims.modules precedent) — no network activity of its own; refreshClaims()
// is the staleness lever. Ghost nodes (residentId null — ancestors the user holds no residency
// in) are never current and never enterable.

export type ResidencySwitchNode = ResidencyTreeNode & {
  isCurrent: boolean
  canEnter: boolean
  children: ResidencySwitchNode[]
}

export type UseResidencySwitcherReturn = {
  roots: ComputedRef<ResidencySwitchNode[]>
  switchResidency: (residentId: string) => Promise<void>
}

export const useResidencySwitcher = (): UseResidencySwitcherReturn => {
  const { user, switchResidency } = useAuth()

  const roots = computed<ResidencySwitchNode[]>(() => {
    const residencies = user.value?.residencies ?? []
    const currentResidentId = user.value?.residentId ?? null

    const byTenantId = new Map<string, ResidencySwitchNode>()
    for (const r of residencies) {
      const isCurrent = r.residentId != null && r.residentId === currentResidentId
      byTenantId.set(r.tenantId, {
        ...r,
        isCurrent,
        canEnter:
          !isCurrent
          && r.residentId != null
          && r.tenantStatus === 'ACTIVE'
          && r.residentStatus != null
          && ENTERABLE_STATUSES.includes(r.residentStatus),
        children: [],
      })
    }

    const rootNodes: ResidencySwitchNode[] = []
    for (const node of byTenantId.values()) {
      const parent = node.parentTenantId ? byTenantId.get(node.parentTenantId) : undefined
      // missing parent ⇒ treat as root (defensive; the DEFINER walk returns every ancestor)
      if (parent) parent.children.push(node)
      else rootNodes.push(node)
    }

    const byName = (a: ResidencySwitchNode, b: ResidencySwitchNode) =>
      a.tenantName.localeCompare(b.tenantName)
    for (const node of byTenantId.values()) node.children.sort(byName)
    rootNodes.sort(byName)

    return rootNodes
  })

  return { roots, switchResidency }
}
