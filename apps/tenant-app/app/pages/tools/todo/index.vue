<script setup lang="ts">
const toast = useToast()
const { todos, fetching, search, createTodo, pinTodo, unpinTodo } = useTodoList()

const showTemplates = ref(false)
const searchTerm = ref('')

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(searchTerm, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    search(val, showTemplates.value)
  }, 300)
})

function toggleTemplates() {
  showTemplates.value = !showTemplates.value
  search(searchTerm.value, showTemplates.value)
}

async function handleCreate(name: string, description?: string) {
  try {
    const { id } = await createTodo(name, description)
    await navigateTo(`/tools/todo/${id}`)
  } catch {
    toast.add({ title: 'Failed to create todo', color: 'error' })
  }
}

async function handlePin(todoId: string) {
  try {
    await pinTodo(todoId)
  } catch {
    toast.add({ title: 'Failed to pin', color: 'error' })
  }
}

async function handleUnpin(todoId: string) {
  try {
    await unpinTodo(todoId)
  } catch {
    toast.add({ title: 'Failed to unpin', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader
      :title="showTemplates ? 'Templates' : 'Todos'"
      :subtitle="`${todos.length} ${showTemplates ? 'templates' : 'open'}`"
    >
      <template #actions>
        <TodoModal @create="handleCreate" />
      </template>
    </PageHeader>

    <div class="flex flex-wrap items-center gap-3">
      <UInput
        v-model="searchTerm"
        icon="i-lucide-search"
        placeholder="Search todos…"
        class="w-64"
        :trailing-icon="searchTerm ? 'i-lucide-x' : undefined"
        @click:trailing="searchTerm = ''"
      />
      <UButton variant="outline" color="neutral" size="sm" @click="toggleTemplates">
        {{ showTemplates ? 'Hide Templates' : 'Show Templates' }}
      </UButton>
    </div>

    <div v-if="fetching" class="rounded-[10px] border border-default bg-default py-8 text-center text-sm text-muted">
      Loading…
    </div>

    <template v-else>
      <div class="hidden overflow-hidden rounded-[10px] border border-default bg-default md:block">
        <TodoList :todos="todos" @pin="handlePin" @unpin="handleUnpin" />
      </div>
      <div class="block rounded-[10px] border border-default bg-default px-4 md:hidden">
        <TodoListSmall :todos="todos" @pin="handlePin" @unpin="handleUnpin" />
      </div>
    </template>
  </div>
</template>
