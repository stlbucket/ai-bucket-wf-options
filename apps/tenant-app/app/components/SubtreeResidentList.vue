<template>
  <UEmpty
    v-if="!users.length"
    icon="i-lucide-users"
    label="No residents found."
  />
  <div
    v-else
    class="overflow-x-auto"
  >
    <UTable
      :data="users"
      :columns="columns"
      class="grow"
    >
      <template #displayName-cell="{ row }">
        <NuxtLink
          :to="`/admin/user/${row.original.linkResidentId}`"
          class="font-medium hover:underline"
        >
          {{ row.original.displayName || row.original.email }}
        </NuxtLink>
      </template>
      <template #currentStatus-cell="{ row }">
        <UBadge
          v-if="row.original.currentStatus"
          :color="statusColor('resident', row.original.currentStatus)"
          variant="subtle"
          size="sm"
        >
          {{ statusLabel(row.original.currentStatus) }}
        </UBadge>
        <span
          v-else
          class="text-muted"
        >—</span>
      </template>
      <template #tenants-cell="{ row }">
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="tenancy in row.original.tenancies"
            :key="tenancy.residentId"
            :color="statusColor('resident', tenancy.status)"
            variant="subtle"
            size="sm"
          >
            {{ tenancy.tenantName }}
          </UBadge>
        </div>
      </template>
    </UTable>
  </div>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type { SubtreeUserView } from '@function-bucket/fnb-graphql-client-api'

defineProps<{
  users: SubtreeUserView[]
}>()

const columns: TableColumn<SubtreeUserView>[] = [
  { accessorKey: 'displayName', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'currentStatus', header: 'Status' },
  { id: 'tenants', header: 'Tenants' }
]
</script>
