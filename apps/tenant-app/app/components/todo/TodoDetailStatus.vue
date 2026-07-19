<script lang="ts" setup>
const props = defineProps<{
  todoId: any
  status: string
}>()

const emit = defineEmits<{
  (e: 'update-status', todoId: string, status: string): void
}>()

const statusOptions = [
  { label: 'Incomplete', value: 'INCOMPLETE' },
  { label: 'Complete', value: 'COMPLETE' },
  { label: 'Unfinished', value: 'UNFINISHED' },
  { label: 'Archived', value: 'ARCHIVED' },
]
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <UButton
      v-for="opt in statusOptions"
      :key="opt.value"
      size="xs"
      :color="status === opt.value ? statusColor('todo', opt.value) : 'neutral'"
      :variant="status === opt.value ? 'solid' : 'outline'"
      @click="emit('update-status', String(todoId), opt.value)"
    >
      {{ opt.label }}
    </UButton>
  </div>
</template>
