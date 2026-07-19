<template>
  <UEmpty
    v-if="!topics.length"
    icon="i-lucide-messages-square"
    label="No conversations found."
  />
  <div
    v-else
    class="overflow-x-auto"
  >
    <UTable
      v-model:sorting="sorting"
      :data="topics"
      :columns="columns"
      class="grow"
    >
      <template #topic-cell="{ row }">
        <div class="flex flex-col gap-0.5">
          <span class="font-medium">{{ row.original.name }}</span>
          <span
            v-if="row.original.participantNames.length"
            class="text-xs text-muted"
          >
            {{ row.original.participantNames.join(', ') }}
          </span>
        </div>
      </template>
      <template #lastMessageAt-cell="{ row }">
        <span class="text-sm text-muted">
          {{ row.original.lastMessageAt ? new Date(row.original.lastMessageAt).toLocaleDateString() : '—' }}
        </span>
      </template>
      <template #isUnread-cell="{ row }">
        <UBadge
          :color="row.original.isUnread ? 'info' : 'neutral'"
          variant="subtle"
          size="sm"
        >
          {{ row.original.isUnread ? 'Unread' : 'Read' }}
        </UBadge>
      </template>
      <template #actions-cell="{ row }">
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-right"
          size="sm"
          :to="`/msg/${row.original.id}`"
        />
      </template>
    </UTable>
  </div>
</template>

<script lang="ts" setup>
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SubscribedTopicSummary } from '@function-bucket/fnb-graphql-client-api'

interface SortableColumn {
  getIsSorted(): false | 'asc' | 'desc'
  toggleSorting(desc?: boolean): void
}

defineProps<{ topics: SubscribedTopicSummary[] }>()

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

const columns: TableColumn<SubscribedTopicSummary>[] = [
  {
    id: 'topic',
    accessorKey: 'name',
    header: ({ column }) => sortHeader(column, 'Topic')
  },
  {
    accessorKey: 'lastMessageAt',
    header: ({ column }) => sortHeader(column, 'Last Message')
  },
  {
    accessorKey: 'isUnread',
    header: 'Status'
  },
  { id: 'actions' }
]
</script>
