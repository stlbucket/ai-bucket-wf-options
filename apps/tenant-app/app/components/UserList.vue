<template>
  <UEmpty
    v-if="!users.length"
    icon="i-lucide-users"
    label="No users found."
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
          :to="`/site-admin/user/${row.original.id}`"
          class="font-medium hover:underline"
        >
          {{ row.original.displayName ?? row.original.email }}
        </NuxtLink>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          :color="statusColor('profile', String(row.original.status))"
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
import type { Profile } from '@function-bucket/fnb-types'

defineProps<{
  users: Profile[]
}>()

const columns: TableColumn<Profile>[] = [
  { accessorKey: 'displayName', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'status', header: 'Status' }
]
</script>
