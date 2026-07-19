<template>
  <UEmpty
    v-if="!subscriptions.length"
    icon="i-lucide-package-x"
    label="No subscriptions found."
  />
  <div
    v-else
    class="overflow-x-auto"
  >
    <UTable
      :data="subscriptions"
      :columns="columns"
      class="grow"
    >
      <template #status-cell="{ row }">
        <UBadge
          :color="statusColor('subscription', String(row.original.status))"
          variant="subtle"
          size="sm"
        >
          {{ statusLabel(String(row.original.status)) }}
        </UBadge>
      </template>
      <template #licensePackKey-cell="{ row }">
        <NuxtLink
          :to="`/admin/subscription/${row.original.id}`"
          class="font-medium hover:underline"
        >
          {{ row.original.licensePackKey }}
        </NuxtLink>
      </template>
      <template #actions-cell="{ row }">
        <UButton
          v-if="row.original.status === 'ACTIVE'"
          size="xs"
          color="warning"
          variant="outline"
          @click="emit('deactivate', row.original.id)"
        >
          Deactivate
        </UButton>
        <UButton
          v-else
          size="xs"
          color="success"
          variant="outline"
          @click="emit('reactivate', row.original.id)"
        >
          Reactivate
        </UButton>
      </template>
    </UTable>
  </div>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type { TenantSubscription } from '@function-bucket/fnb-types'

defineProps<{
  subscriptions: TenantSubscription[]
}>()

const emit = defineEmits<{
  (e: 'deactivate', id: string): void
  (e: 'reactivate', id: string): void
}>()

const columns: TableColumn<TenantSubscription>[] = [
  { accessorKey: 'licensePackKey', header: 'License Pack' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions' }
]
</script>
