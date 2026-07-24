<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PollListItem } from '@function-bucket/fnb-graphql-client-api'

defineProps<{ polls: PollListItem[] }>()

const statusColor = (s: string) => (s === 'OPEN' ? 'success' : s === 'DRAFT' ? 'neutral' : 'info')
const visColor = (v: string) =>
  v === 'ATTRIBUTED' ? 'primary' : v === 'AGGREGATE' ? 'info' : 'neutral'

const columns: TableColumn<PollListItem>[] = [
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'answer', header: 'Your answer' },
  { accessorKey: 'questionCount', header: 'Questions' },
  { accessorKey: 'resultsVisibility', header: 'Results' },
  { accessorKey: 'closesAt', header: 'Closes' },
  { accessorKey: 'createdByName', header: 'Created by' },
]

function fmt(d: Date | null) {
  return d ? d.toLocaleDateString() : '—'
}
</script>

<template>
  <div class="overflow-x-auto">
    <UTable :data="polls" :columns="columns">
      <template #title-cell="{ row }">
        <ULink :to="`/tools/poll/${row.original.id}`" class="font-medium text-highlighted">
          {{ row.original.title }}
        </ULink>
      </template>
      <template #status-cell="{ row }">
        <UBadge :color="statusColor(row.original.status)" variant="subtle" size="sm">
          {{ row.original.status.toLowerCase() }}
        </UBadge>
      </template>
      <template #answer-cell="{ row }">
        <UBadge
          v-if="row.original.answered"
          color="success"
          variant="subtle"
          size="sm"
          icon="i-lucide-check"
        >
          Answered
        </UBadge>
        <UBadge
          v-else-if="row.original.responseInProgress"
          color="info"
          variant="subtle"
          size="sm"
        >
          In progress
        </UBadge>
        <UBadge v-else color="warning" variant="subtle" size="sm">Not answered</UBadge>
      </template>
      <template #resultsVisibility-cell="{ row }">
        <UBadge :color="visColor(row.original.resultsVisibility)" variant="outline" size="sm">
          {{ row.original.resultsVisibility.toLowerCase() }}
        </UBadge>
      </template>
      <template #closesAt-cell="{ row }">{{ fmt(row.original.closesAt) }}</template>
      <template #createdByName-cell="{ row }">{{ row.original.createdByName ?? '—' }}</template>
    </UTable>
  </div>
</template>
