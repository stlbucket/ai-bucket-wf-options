<script setup lang="ts">
import { formatUrn } from '@function-bucket/fnb-types'

const toast = useToast()
const { todos, fetching, search, filterAssignedTo, createTodo, pinTodo, unpinTodo } = useTodoList()
const { user } = useAuth()

const showTemplates = ref(false)
const searchTerm = ref('')
const assignedToMe = ref(false)

// The caller's own resident urn, resolved client-side from claims (frozen URN grammar —
// the DB filter stays a plain urn parameter; _fn never calls jwt.*).
const myResidentUrn = computed(() => {
  const claims = user.value
  if (!claims?.tenantId || !claims?.residentId) return null
  return formatUrn({
    tenantId: claims.tenantId,
    module: 'app',
    resourceType: 'resident',
    id: claims.residentId,
  })
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(searchTerm, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    search(val, showTemplates.value)
  }, 300)
})

function toggleTemplates() {
  showTemplates.value = !showTemplates.value
  // templates carry no assignees — clear the filter when entering template view
  if (showTemplates.value && assignedToMe.value) {
    assignedToMe.value = false
    filterAssignedTo(null)
  }
  search(searchTerm.value, showTemplates.value)
}

function toggleAssignedToMe() {
  assignedToMe.value = !assignedToMe.value
  filterAssignedTo(assignedToMe.value ? myResidentUrn.value : null)
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
      <UButton
        v-if="!showTemplates"
        :variant="assignedToMe ? 'solid' : 'outline'"
        :color="assignedToMe ? 'primary' : 'neutral'"
        size="sm"
        icon="i-lucide-user-check"
        @click="toggleAssignedToMe"
      >
        Assigned to me
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
