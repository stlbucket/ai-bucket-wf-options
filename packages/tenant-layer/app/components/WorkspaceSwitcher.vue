<script setup lang="ts">
import { useAuth } from '@function-bucket/fnb-auth-layer/app/composables/useAuth'
import {
  useResidencySwitcher,
  type ResidencySwitchNode,
} from '@function-bucket/fnb-auth-layer/app/composables/useResidencySwitcher'
import type { TreeItem } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'

// Self-contained (owns trigger + modal state — the WorkspaceCreateModal precedent). Renders the
// residency tree purely from localStorage claims; the on-open refreshClaims() is the only fetch.
// Spec: .claude/specs/workspace-switcher/switcher.ui.md.

defineProps<{ collapsed?: boolean }>()

const { user, isLoggedIn, refreshClaims } = useAuth()
const { roots, switchResidency } = useResidencySwitcher()
const toast = useToast()

const open = ref(false)
const switching = ref(false) // a switch is in flight — the full reload ends it
const refreshing = ref(false) // the on-open refreshClaims is in flight
const switchingTenantId = ref<string | null>(null)

const isInSupportMode = computed(() => user.value?.permissions?.includes('p:exit-support'))

// Tree renders from current claims immediately; the background refresh updates it if changed.
// Refresh failure keeps the last-known tree (claims are still valid locally) and toasts.
watch(open, (isOpen) => {
  if (!isOpen) return
  refreshing.value = true
  refreshClaims()
    .catch(() => {
      toast.add({ title: 'Could not refresh workspaces', color: 'error' })
    })
    .finally(() => {
      refreshing.value = false
    })
})

function toItem(node: ResidencySwitchNode): TreeItem {
  return {
    value: node.tenantId,
    label: node.tenantName,
    icon: node.tenantType === 'WORKSPACE' ? 'i-lucide-network' : 'i-lucide-building-2',
    defaultExpanded: true,
    disabled: !node.canEnter,
    children: node.children.length > 0 ? node.children.map(toItem) : undefined,
    onSelect: () => onNodeSelect(node),
    node,
  }
}

const items = computed<TreeItem[]>(() => roots.value.map(toItem))

// Disabled/muted reasons, in priority order: ghost nodes show a lock (no residency at all);
// nodes with a residency that still isn't enterable show why as a status badge (UC1 shared
// tenant/resident maps) — the tenant's status when the tenant isn't ACTIVE, else the residency's.
function statusBadge(node: ResidencySwitchNode) {
  if (node.isCurrent || node.canEnter || node.residentId === null) return null
  if (node.tenantStatus !== 'ACTIVE') {
    return { color: statusColor('tenant', node.tenantStatus), label: statusLabel(node.tenantStatus) }
  }
  return {
    color: statusColor('resident', node.residentStatus),
    label: statusLabel(node.residentStatus),
  }
}

async function onNodeSelect(node: ResidencySwitchNode) {
  if (!node.canEnter || node.residentId === null || switching.value) return
  switching.value = true
  switchingTenantId.value = node.tenantId
  try {
    // assumeResidency → refreshClaims → full reload home; the reload ends the interaction,
    // so the modal never needs to close itself.
    await switchResidency(node.residentId)
  } catch {
    toast.add({ title: 'Failed to switch workspace', color: 'error' })
    switching.value = false
    switchingTenantId.value = null
  }
}
</script>

<template>
  <div v-if="isLoggedIn && user?.tenantName">
    <!-- Support mode: static row — switching would silently drop the support session -->
    <div
      v-if="isInSupportMode"
      class="flex items-center gap-2.5 rounded-md py-2 text-sm text-white/85"
      :class="collapsed ? 'justify-center' : 'px-2.5'"
      title="Exit support to switch"
    >
      <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
      <span v-if="!collapsed" class="truncate">{{ user?.tenantName }}</span>
    </div>

    <UTooltip
      v-else-if="collapsed"
      :text="`Switch workspace — ${user?.tenantName}`"
      :content="{ side: 'right' }"
    >
      <button
        type="button"
        aria-label="Switch workspace"
        class="flex w-full items-center justify-center rounded-md py-2 text-white/85 hover:bg-white/10 hover:text-white"
        @click="open = true"
      >
        <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
      </button>
    </UTooltip>

    <button
      v-else
      type="button"
      aria-label="Switch workspace"
      class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white"
      @click="open = true"
    >
      <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
      <span class="flex-1 truncate text-left">{{ user?.tenantName }}</span>
      <UIcon name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-white/50" />
    </button>

    <UModal v-model:open="open" title="Switch workspace">
      <template #body>
        <div class="flex flex-col gap-3">
          <UProgress v-if="refreshing" size="xs" />

          <div v-if="roots.length === 0" class="flex flex-col gap-2">
            <USkeleton v-for="i in 3" :key="i" class="h-6 w-full" />
          </div>

          <UTree v-else :items="items" :disabled="switching">
            <template #item-label="{ item }">
              <span class="flex min-w-0 items-center gap-2">
                <span
                  class="truncate"
                  :class="item.node.canEnter || item.node.isCurrent ? '' : 'text-muted'"
                >
                  {{ item.node.tenantName }}
                </span>
                <UBadge
                  v-if="item.node.isCurrent"
                  color="primary"
                  variant="subtle"
                  size="sm"
                >
                  Current
                </UBadge>
                <UBadge
                  v-else-if="statusBadge(item.node)"
                  :color="statusBadge(item.node)!.color"
                  variant="subtle"
                  size="sm"
                >
                  {{ statusBadge(item.node)!.label }}
                </UBadge>
              </span>
            </template>
            <template #item-trailing="{ item }">
              <UIcon
                v-if="switchingTenantId === item.node.tenantId"
                name="i-lucide-loader-circle"
                class="size-4 shrink-0 animate-spin"
              />
              <UIcon
                v-else-if="item.node.residentId === null"
                name="i-lucide-lock"
                class="size-4 shrink-0 text-muted"
                title="No residency in this workspace"
              />
            </template>
          </UTree>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end">
          <UButton variant="ghost" color="neutral" @click="open = false">
            Cancel
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
