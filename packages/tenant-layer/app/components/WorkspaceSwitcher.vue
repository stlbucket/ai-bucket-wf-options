<script setup lang="ts">
import { useAuth } from '@function-bucket/fnb-auth-layer/app/composables/useAuth'
import {
  useResidencySwitcher,
  type ResidencySwitchNode,
} from '@function-bucket/fnb-auth-layer/app/composables/useResidencySwitcher'
import { computed, ref, watch } from 'vue'

// Self-contained (owns trigger + modal state — the WorkspaceCreateModal precedent). Renders the
// residency tree purely from localStorage claims via the shared ResidencyTree component; the
// on-open refreshClaims() is the only fetch. The switch call stays here (R2).
// Spec: docs/specs/workspace-switcher/switcher.ui.md.

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

          <ResidencyTree
            v-else
            :nodes="roots"
            :disabled="switching"
            :switching-tenant-id="switchingTenantId"
            @select="onNodeSelect"
          />
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
