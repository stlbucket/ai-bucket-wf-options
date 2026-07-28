<script setup lang="ts">
import type { ResidencySwitchNode } from '@function-bucket/fnb-auth-layer/app/composables/useResidencySwitcher'
import type { TreeItem } from '@nuxt/ui'
import { computed } from 'vue'

// Presentational residency tree (R2 — no API calls, no switch logic), extracted from
// WorkspaceSwitcher.vue so the sidebar modal and the home-app landing cards share one
// implementation. Emits `select` only for enterable nodes; the consumer owns the switch call.
// Spec: .claude/specs/home-app/index.ui.md.

const props = defineProps<{
  nodes: ResidencySwitchNode[]
  disabled?: boolean
  switchingTenantId?: string | null
}>()

const emit = defineEmits<{
  select: [node: ResidencySwitchNode]
}>()

function toItem(node: ResidencySwitchNode): TreeItem {
  return {
    value: node.tenantId,
    label: node.tenantName,
    icon: node.tenantType === 'WORKSPACE' ? 'i-lucide-network' : 'i-lucide-building-2',
    defaultExpanded: true,
    disabled: !node.canEnter,
    children: node.children.length > 0 ? node.children.map(toItem) : undefined,
    onSelect: () => onNodeSelect(node),
    node
  }
}

const items = computed<TreeItem[]>(() => props.nodes.map(toItem))

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
    label: statusLabel(node.residentStatus)
  }
}

function onNodeSelect(node: ResidencySwitchNode) {
  if (!node.canEnter || node.residentId === null || props.disabled) return
  emit('select', node)
}
</script>

<template>
  <UTree :items="items" :disabled="disabled">
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
</template>
