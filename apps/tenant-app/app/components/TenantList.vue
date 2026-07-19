<template>
  <UEmpty
    v-if="!tenants.length"
    icon="i-lucide-building-2"
    label="No tenants found."
  />
  <div
    v-else
    class="overflow-x-auto"
  >
    <UTable
      :data="tenants"
      :columns="columns"
      class="grow"
    >
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/site-admin/tenant/${row.original.id}`"
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
      <template #actions-cell="{ row }">
        <SupportButton
          :tenant="row.original"
          :can-support="canSupport && row.original.type !== 'anchor'"
          @confirm="(t) => emit('support', t)"
        />
      </template>
    </UTable>
  </div>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type { Tenant } from '@function-bucket/fnb-types'

defineProps<{
  tenants: Tenant[]
  canSupport?: boolean
}>()

const emit = defineEmits<{
  (e: 'support', tenant: Tenant): void
}>()

const columns: TableColumn<Tenant>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'identifier', header: 'Identifier' },
  { id: 'actions' }
]
</script>
