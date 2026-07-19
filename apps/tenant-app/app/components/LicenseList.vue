<template>
  <UEmpty
    v-if="!licenses.length"
    icon="i-lucide-file-x"
    label="No licenses found."
  />
  <div
    v-else
    class="overflow-x-auto"
  >
    <UTable
      v-model:sorting="sorting"
      :data="licenses"
      :columns="columns"
      class="grow"
    >
      <template #resident-cell="{ row }">
        <NuxtLink
          :to="`/admin/user/${row.original.residentId}`"
          class="hover:underline"
        >
          {{ residentMap[row.original.residentId]?.displayName ?? residentMap[row.original.residentId]?.email ?? row.original.residentId }}
        </NuxtLink>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          :color="statusColor('license', String(row.original.status))"
          variant="subtle"
          size="sm"
        >
          {{ statusLabel(String(row.original.status)) }}
        </UBadge>
      </template>
      <template #expiresAt-cell="{ row }">
        {{ row.original.expiresAt ? new Date(row.original.expiresAt).toLocaleDateString() : '—' }}
      </template>
      <template #actions-cell="{ row }">
        <UButton
          v-if="row.original.status !== 'ACTIVE'"
          size="xs"
          color="success"
          variant="outline"
          @click="emit('activate', row.original.id)"
        >
          Activate
        </UButton>
        <UButton
          v-else
          size="xs"
          color="warning"
          variant="outline"
          @click="emit('deactivate', row.original.id)"
        >
          Deactivate
        </UButton>
      </template>
    </UTable>
  </div>
</template>

<script lang="ts" setup>
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { License, Resident } from '@function-bucket/fnb-types'

interface SortableColumn {
  getIsSorted(): false | 'asc' | 'desc'
  toggleSorting(desc?: boolean): void
}

const props = defineProps<{
  licenses: License[]
  residents: Resident[]
}>()

const emit = defineEmits<{
  (e: 'activate', id: string): void
  (e: 'deactivate', id: string): void
}>()

const sorting = ref([])

const residentMap = computed(() =>
  Object.fromEntries(props.residents.map(r => [r.id, r]))
)

function sortHeader(column: SortableColumn, label: string) {
  const isSorted = column.getIsSorted()
  return h(resolveComponent('UButton'), {
    color: 'neutral',
    variant: 'ghost',
    label,
    icon: isSorted === 'asc'
      ? 'i-lucide-arrow-up-narrow-wide'
      : isSorted === 'desc'
        ? 'i-lucide-arrow-down-wide-narrow'
        : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
  })
}

const columns = computed<TableColumn<License>[]>(() => [
  {
    id: 'resident',
    header: ({ column }) => sortHeader(column, 'User'),
    accessorFn: row =>
      residentMap.value[row.residentId]?.displayName
      ?? residentMap.value[row.residentId]?.email
      ?? ''
  },
  {
    accessorKey: 'licenseTypeKey',
    header: ({ column }) => sortHeader(column, 'License Type')
  },
  {
    accessorKey: 'status',
    header: ({ column }) => sortHeader(column, 'Status')
  },
  {
    accessorKey: 'expiresAt',
    header: ({ column }) => sortHeader(column, 'Expires')
  },
  { id: 'actions' }
])
</script>
