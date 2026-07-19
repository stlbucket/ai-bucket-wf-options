<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'

type TodoListItem = {
  id: any
  name: string
  type: string
  status: string
  pinned: boolean
  updatedAt: any
}

const props = defineProps<{
  todos: TodoListItem[]
}>()

const emit = defineEmits<{
  (e: 'pin', todoId: string): void
  (e: 'unpin', todoId: string): void
}>()

const columns: TableColumn<TodoListItem>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'type', header: 'Type' },
  { id: 'actions' },
]
</script>

<template>
  <UEmpty v-if="!props.todos.length" icon="i-lucide-list-todo" label="No todos found." />

  <div v-else class="overflow-x-auto">
    <UTable :data="props.todos" :columns="columns" class="grow">
      <template #name-cell="{ row }">
        <NuxtLink
          :to="`/tools/todo/${row.original.id}`"
          class="font-medium hover:underline flex items-center gap-1"
        >
          <UIcon
            v-if="row.original.pinned"
            name="i-lucide-pin"
            class="text-primary shrink-0"
            size="14"
          />
          {{ row.original.name }}
        </NuxtLink>
      </template>

      <template #status-cell="{ row }">
        <UBadge :color="statusColor('todo', row.original.status)" variant="subtle" size="sm">
          {{ statusLabel(row.original.status) }}
        </UBadge>
      </template>

      <template #type-cell="{ row }">
        <UBadge
          v-if="row.original.type === 'MILESTONE'"
          color="info"
          variant="subtle"
          size="sm"
        >
          milestone
        </UBadge>
        <span v-else class="text-sm text-muted">task</span>
      </template>

      <template #actions-cell="{ row }">
        <div class="flex items-center gap-1">
          <UButton
            v-if="row.original.pinned"
            variant="ghost"
            color="neutral"
            icon="i-lucide-pin-off"
            size="xs"
            title="Unpin"
            @click.prevent="emit('unpin', String(row.original.id))"
          />
          <UButton
            v-else
            variant="ghost"
            color="neutral"
            icon="i-lucide-pin"
            size="xs"
            title="Pin"
            @click.prevent="emit('pin', String(row.original.id))"
          />
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-lucide-arrow-right"
            size="xs"
            :to="`/tools/todo/${row.original.id}`"
          />
        </div>
      </template>
    </UTable>
  </div>
</template>
