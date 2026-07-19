<template>
  <UEmpty
    v-if="!tickets.length"
    icon="i-lucide-ticket"
    label="No tickets found."
  />
  <div
    v-else
    class="overflow-x-auto"
  >
    <UTable
      v-model:sorting="sorting"
      :data="tickets"
      :columns="columns"
      class="grow"
    >
      <template #title-cell="{ row }">
        <span class="font-medium">{{ row.original.title }}</span>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          :color="statusColor('ticket', String(row.original.status))"
          variant="subtle"
          size="sm"
        >
          {{ statusLabel(String(row.original.status)) }}
        </UBadge>
      </template>
      <template #createdAt-cell="{ row }">
        <span class="text-sm text-muted">{{ new Date(row.original.createdAt).toLocaleDateString() }}</span>
      </template>
      <template #actions-cell="{ row }">
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-right"
          size="sm"
          :to="`/support/tickets/${row.original.id}`"
        />
      </template>
    </UTable>
  </div>
</template>

<script lang="ts" setup>
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ticket = { id: any, title: string, status: string, createdAt: any }

interface SortableColumn {
  getIsSorted(): false | 'asc' | 'desc'
  toggleSorting(desc?: boolean): void
}

defineProps<{ tickets: Ticket[] }>()

const sorting = ref([])

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

const columns: TableColumn<Ticket>[] = [
  {
    accessorKey: 'title',
    header: ({ column }) => sortHeader(column, 'Title')
  },
  {
    accessorKey: 'status',
    header: ({ column }) => sortHeader(column, 'Status')
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => sortHeader(column, 'Submitted')
  },
  { id: 'actions' }
]
</script>
