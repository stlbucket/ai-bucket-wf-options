<template>
  <UEmpty
    v-if="!residents.length"
    icon="i-lucide-users"
    label="No residents found."
  />
  <div
    v-else
    class="overflow-x-auto"
  >
    <UTable
      :data="residents"
      :columns="columns"
      class="grow"
    >
      <template #displayName-cell="{ row }">
        <NuxtLink
          :to="`/admin/user/${row.original.id}`"
          class="font-medium hover:underline"
        >
          {{ row.original.displayName ?? row.original.email }}
        </NuxtLink>
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
    </UTable>
  </div>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type { Resident } from '@function-bucket/fnb-types'

defineProps<{
  residents: Resident[]
}>()

const columns: TableColumn<Resident>[] = [
  { accessorKey: 'displayName', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'type', header: 'Type' }
]
</script>
