<template>
  <UEmpty
    v-if="!workspaces.length"
    icon="i-lucide-network"
    label="No workspaces yet."
    description="Create a workspace to give a team its own nested tenant."
  />
  <div
    v-else
    class="overflow-x-auto"
  >
    <UTable
      :data="workspaces"
      :columns="columns"
      class="grow"
    >
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/admin/workspace/${row.original.id}`"
          class="font-medium hover:underline"
        >
          {{ row.original.name }}
        </NuxtLink>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          :color="statusColor('tenant', String(row.original.status))"
          variant="subtle"
          size="sm"
        >
          {{ statusLabel(String(row.original.status)) }}
        </UBadge>
      </template>
      <template #membership-cell="{ row }">
        <UBadge
          :color="row.original.myResidentId ? 'primary' : 'neutral'"
          variant="subtle"
          size="sm"
        >
          {{ row.original.myResidentId ? 'Member' : 'Not a member' }}
        </UBadge>
      </template>
      <template #identifier-cell="{ row }">
        <span class="text-muted">{{ row.original.identifier ?? '—' }}</span>
      </template>
      <template #createdAt-cell="{ row }">
        {{ new Date(row.original.createdAt).toLocaleDateString() }}
      </template>
      <template #actions-cell="{ row }">
        <UTooltip
          v-if="row.original.myResidentId && !row.original.canEnter"
          text="This workspace is inactive"
        >
          <UButton
            size="xs"
            variant="outline"
            color="neutral"
            icon="i-lucide-log-in"
            disabled
          >
            Enter
          </UButton>
        </UTooltip>
        <UButton
          v-else-if="row.original.canEnter"
          size="xs"
          variant="outline"
          icon="i-lucide-log-in"
          :loading="enteringId === row.original.id"
          @click="emit('enter', row.original)"
        >
          Enter
        </UButton>
      </template>
    </UTable>
  </div>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type { WorkspaceView } from '@function-bucket/fnb-graphql-client-api'

defineProps<{
  workspaces: WorkspaceView[]
  enteringId?: string | null
}>()

const emit = defineEmits<{
  (e: 'enter', workspace: WorkspaceView): void
}>()

const columns: TableColumn<WorkspaceView>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'membership', header: 'Membership' },
  { accessorKey: 'identifier', header: 'Identifier' },
  { accessorKey: 'createdAt', header: 'Created' },
  { id: 'actions' }
]
</script>
