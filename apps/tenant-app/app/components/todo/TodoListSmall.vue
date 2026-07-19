<script lang="ts" setup>
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
</script>

<template>
  <UEmpty v-if="!props.todos.length" icon="i-lucide-list-todo" label="No todos found." />

  <div v-else class="flex flex-col divide-y divide-default">
    <NuxtLink
      v-for="todo in props.todos"
      :key="String(todo.id)"
      :to="`/tools/todo/${todo.id}`"
      class="flex items-center justify-between py-3 px-1 hover:bg-muted/50 transition-colors"
    >
      <div class="flex items-start gap-2 min-w-0">
        <UIcon
          v-if="todo.pinned"
          name="i-lucide-pin"
          class="text-primary shrink-0 mt-0.5"
          size="14"
        />
        <div class="min-w-0">
          <p class="font-medium text-sm truncate">{{ todo.name }}</p>
          <div class="flex items-center gap-1 mt-0.5">
            <UBadge :color="statusColor('todo', todo.status)" variant="subtle" size="xs">
              {{ statusLabel(todo.status) }}
            </UBadge>
            <UBadge
              v-if="todo.type === 'MILESTONE'"
              color="info"
              variant="subtle"
              size="xs"
            >
              milestone
            </UBadge>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0 ml-2">
        <UButton
          v-if="todo.pinned"
          variant="ghost"
          color="neutral"
          icon="i-lucide-pin-off"
          size="xs"
          title="Unpin"
          @click.prevent="emit('unpin', String(todo.id))"
        />
        <UButton
          v-else
          variant="ghost"
          color="neutral"
          icon="i-lucide-pin"
          size="xs"
          title="Pin"
          @click.prevent="emit('pin', String(todo.id))"
        />
        <UIcon name="i-lucide-chevron-right" class="text-muted" size="16" />
      </div>
    </NuxtLink>
  </div>
</template>
