<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type { TodoAssigneeView } from '~/composables/useTodoDetail'

type TodoListItem = {
  id: any
  name: string
  type: string
  status: string
  pinned: boolean
  updatedAt: any
  assignees: TodoAssigneeView[]
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
  { id: 'assignees', header: 'Assignees' },
  { id: 'actions' },
]

function initialsFor(name: string | null): string {
  const trimmed = name?.trim()
  if (!trimmed) return '?'
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('')
}
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

      <template #assignees-cell="{ row }">
        <span
          v-if="!row.original.assignees.length"
          class="text-sm text-muted"
        >—</span>
        <div
          v-else
          class="flex items-center -space-x-1"
        >
          <span
            v-for="assignee in row.original.assignees.slice(0, 3)"
            :key="assignee.residentUrn"
            class="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary ring-1 ring-default"
            :title="assignee.displayName ?? undefined"
          >
            {{ initialsFor(assignee.displayName) }}
          </span>
          <span
            v-if="row.original.assignees.length > 3"
            class="pl-2 text-[11px] text-muted"
          >+{{ row.original.assignees.length - 3 }}</span>
        </div>
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
