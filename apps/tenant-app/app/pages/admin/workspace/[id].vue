<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { TenantType } from '@function-bucket/fnb-types'
import type { WorkspaceResidentView } from '@function-bucket/fnb-graphql-client-api'
import { useWorkspaceDetail } from '~/composables/useWorkspaces'

const residentColumns: TableColumn<WorkspaceResidentView>[] = [
  { accessorKey: 'displayName', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'type', header: 'Type' },
  { id: 'licenses', header: 'Licenses' }
]

const route = useRoute()
const toast = useToast()
const { user, refreshClaims } = useAuth()

const {
  workspace,
  residents,
  subscriptions,
  fetching,
  deactivateWorkspace,
  activateWorkspace,
  enterWorkspace,
  setNestedType
} = useWorkspaceDetail(String(route.params.id))

// Nested-type editor (p:app-admin). Every tenant reachable here is a direct child, so the
// interchangeable nestable trio is always the valid option set.
const canManageType = computed(() => user.value?.permissions?.includes('p:app-admin') ?? false)
const NESTED_TYPE_OPTIONS = ['workspace', 'client', 'organization'].map(v => ({ label: v, value: v }))
const typeForm = ref('')
const savingType = ref(false)
watchEffect(() => {
  if (workspace.value) typeForm.value = String(workspace.value.type).toLowerCase()
})

async function onSaveType() {
  if (!workspace.value) return
  savingType.value = true
  try {
    await setNestedType(typeForm.value.toUpperCase() as TenantType)
    toast.add({ title: 'Type updated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to update type', color: 'error' })
  } finally {
    savingType.value = false
  }
}

// The current user's own residency in this workspace (drives the Enter button)
const myResident = computed(
  () => residents.value.find(r => r.email === user.value?.email) ?? null
)
const canEnter = computed(
  () =>
    myResident.value != null
    && workspace.value?.status === 'ACTIVE'
    && !['BLOCKED_INDIVIDUAL', 'BLOCKED_TENANT', 'DECLINED'].includes(String(myResident.value.status))
)

const confirmAction = ref<'deactivate' | 'activate' | null>(null)
const confirmOpen = computed({
  get: () => confirmAction.value !== null,
  set: (v: boolean) => {
    if (!v) confirmAction.value = null
  }
})
const acting = ref(false)
const entering = ref(false)

async function onConfirm() {
  if (!confirmAction.value) return
  acting.value = true
  try {
    if (confirmAction.value === 'deactivate') {
      await deactivateWorkspace()
      toast.add({ title: 'Workspace deactivated', color: 'success' })
    } else {
      await activateWorkspace()
      toast.add({ title: 'Workspace reactivated', color: 'success' })
    }
    confirmAction.value = null
  } catch {
    toast.add({ title: 'Failed to update workspace', color: 'error' })
  } finally {
    acting.value = false
  }
}

async function onEnter() {
  if (!myResident.value) return
  entering.value = true
  try {
    await enterWorkspace(myResident.value.id)
    await refreshClaims()
    toast.add({ title: `Entered ${workspace.value?.name}`, color: 'success' })
    navigateTo('/', { external: true })
  } catch {
    entering.value = false
    toast.add({ title: 'Failed to enter workspace', color: 'error' })
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-4 p-6 sm:p-9">
    <UButton
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      to="/admin/workspace"
      size="sm"
      class="-ml-2 text-muted"
    >
      Workspaces
    </UButton>

    <UEmpty
      v-if="!workspace && !fetching"
      icon="i-lucide-network"
      label="Workspace not found."
      description="It may not be a workspace of this tenant."
    />

    <template v-if="workspace">
      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <h1 class="text-lg font-semibold">
                {{ workspace.name }}
              </h1>
              <UBadge
                :color="statusColor('tenant', String(workspace.status))"
                variant="subtle"
                size="sm"
              >
                {{ statusLabel(String(workspace.status)) }}
              </UBadge>
            </div>
            <div class="flex gap-2">
              <UButton
                v-if="canEnter"
                size="sm"
                variant="outline"
                icon="i-lucide-log-in"
                :loading="entering"
                @click="onEnter"
              >
                Enter
              </UButton>
              <UButton
                v-if="workspace.status === 'ACTIVE'"
                size="sm"
                color="error"
                variant="soft"
                @click="confirmAction = 'deactivate'"
              >
                Deactivate
              </UButton>
              <UButton
                v-else
                size="sm"
                color="primary"
                variant="soft"
                @click="confirmAction = 'activate'"
              >
                Reactivate
              </UButton>
            </div>
          </div>
        </template>

        <div class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
          <div class="text-muted">
            Identifier
          </div>
          <div>{{ workspace.identifier ?? '—' }}</div>
          <div class="text-muted">
            Type
          </div>
          <div>
            <div
              v-if="canManageType"
              class="flex items-center gap-2"
            >
              <USelect
                v-model="typeForm"
                :items="NESTED_TYPE_OPTIONS"
                :disabled="savingType"
                size="sm"
              />
              <UButton
                size="sm"
                variant="soft"
                :loading="savingType"
                :disabled="typeForm === String(workspace.type).toLowerCase()"
                @click="onSaveType"
              >
                Save
              </UButton>
            </div>
            <template v-else>
              {{ statusLabel(String(workspace.type)) }}
            </template>
          </div>
          <div class="text-muted">
            ID
          </div>
          <div class="font-mono text-xs">
            {{ workspace.id }}
          </div>
          <div class="text-muted">
            Created
          </div>
          <div>{{ new Date(workspace.createdAt).toLocaleString() }}</div>
          <div class="text-muted">
            Updated
          </div>
          <div>{{ new Date(workspace.updatedAt).toLocaleString() }}</div>
          <div class="text-muted">
            Subscription
          </div>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="sub in subscriptions"
              :key="sub.id"
              :color="statusColor('subscription', String(sub.status))"
              variant="subtle"
              size="sm"
            >
              {{ sub.licensePackKey }}
            </UBadge>
            <span
              v-if="!subscriptions.length"
              class="text-muted"
            >—</span>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">
              Residents ({{ residents.length }})
            </h2>
            <span class="text-xs text-muted">
              Manage residents by entering the workspace
            </span>
          </div>
        </template>

        <UEmpty
          v-if="!residents.length"
          icon="i-lucide-users"
          label="No residents."
        />
        <div
          v-else
          class="overflow-x-auto"
        >
          <UTable
            :data="residents"
            :columns="residentColumns"
            class="grow"
          >
            <template #displayName-cell="{ row }">
              {{ row.original.displayName ?? '—' }}
            </template>
            <template #status-cell="{ row }">
              <UBadge
                :color="statusColor('resident', String(row.original.status))"
                variant="subtle"
                size="sm"
              >
                {{ statusLabel(String(row.original.status)) }}
              </UBadge>
            </template>
            <template #type-cell="{ row }">
              {{ statusLabel(String(row.original.type)) }}
            </template>
            <template #licenses-cell="{ row }">
              {{ row.original.licenses.map((l) => l.licenseTypeKey).join(', ') || '—' }}
            </template>
          </UTable>
        </div>
      </UCard>

      <UModal
        v-model:open="confirmOpen"
        :title="confirmAction === 'deactivate' ? 'Deactivate workspace' : 'Reactivate workspace'"
      >
        <template #body>
          <div class="flex flex-col gap-4">
            <p class="text-sm">
              <template v-if="confirmAction === 'deactivate'">
                Deactivating blocks every resident of this workspace. Continue?
              </template>
              <template v-else>
                Reactivating restores residents of this workspace. Continue?
              </template>
            </p>
            <div class="flex gap-3">
              <UButton
                :color="confirmAction === 'deactivate' ? 'error' : 'primary'"
                :loading="acting"
                @click="onConfirm"
              >
                {{ confirmAction === 'deactivate' ? 'Deactivate' : 'Reactivate' }}
              </UButton>
              <UButton
                variant="ghost"
                color="neutral"
                @click="confirmAction = null"
              >
                Cancel
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
