<script lang="ts" setup>
import type { TodoNode, TodoOwner } from '~/composables/useTodoDetail'

const props = defineProps<{
  todoId: any
  children: TodoNode[]
}>()

const emit = defineEmits<{
  (e: 'add-subtask', name: string, parentId: string): void
}>()

type WithStatus = { status: string }
function progress(list: WithStatus[]): string {
  const done = list.filter(n => n.status?.trim().toUpperCase() === 'COMPLETE').length
  return `${done}/${list.length}`
}

function ownerLabel(owner?: TodoOwner | null): string {
  const name = owner?.displayName?.trim()
  if (!name) return ''
  const parts = name.split(/\s+/)
  if (parts.length === 1) return parts[0]!
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0).toUpperCase()}.`
}

const showSubtaskModal = ref(false)
const subtaskParentId = ref('')
const subtaskName = ref('')

function openSubtask(parentId: string) {
  subtaskParentId.value = parentId
  subtaskName.value = ''
  showSubtaskModal.value = true
}

function saveSubtask() {
  if (!subtaskName.value.trim()) return
  emit('add-subtask', subtaskName.value.trim(), subtaskParentId.value)
  showSubtaskModal.value = false
}
</script>

<template>
  <section>
    <div class="mb-2 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Subtasks
        </p>
        <span
          v-if="children.length"
          class="font-mono text-[11px] text-muted"
        >{{ progress(children) }} done</span>
      </div>
      <UButton
        size="xs"
        variant="outline"
        color="neutral"
        icon="i-lucide-plus"
        @click="openSubtask(String(todoId))"
      >
        Add subtask
      </UButton>
    </div>

    <div
      v-if="children.length === 0"
      class="text-sm text-muted"
    >
      No subtasks.
    </div>

    <div
      v-else
      class="overflow-hidden rounded-lg border border-default"
    >
      <div
        v-for="child in children"
        :key="String(child.id)"
      >
        <!-- Child row -->
        <div class="group flex items-center gap-2.5 border-b border-default/60 px-3 py-[9px]">
          <TodoStatusDot :status="child.status" />
          <NuxtLink
            :to="`/tools/todo/${child.id}`"
            class="truncate text-[13px] font-medium text-highlighted hover:underline"
          >
            {{ child.name }}
          </NuxtLink>
          <span
            v-if="child.owner"
            class="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted"
          >{{ ownerLabel(child.owner) }}</span>
          <span class="flex-1" />
          <span
            v-if="child.children.length"
            class="font-mono text-[11px] text-muted"
          >{{ progress(child.children) }}</span>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-plus"
            class="opacity-0 group-hover:opacity-100"
            title="Add subtask"
            @click="openSubtask(String(child.id))"
          />
        </div>

        <!-- Grandchildren -->
        <template v-if="child.children.length > 0">
          <div
            v-for="gc in child.children"
            :key="String(gc.id)"
          >
            <div class="group flex items-center gap-2.5 border-b border-default/60 bg-muted/40 py-[9px] pl-9 pr-3">
              <TodoStatusDot :status="gc.status" />
              <NuxtLink
                :to="`/tools/todo/${gc.id}`"
                class="truncate text-[13px] text-highlighted hover:underline"
              >
                {{ gc.name }}
              </NuxtLink>
              <span
                v-if="gc.owner"
                class="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted"
              >{{ ownerLabel(gc.owner) }}</span>
              <span class="flex-1" />
              <span
                v-if="gc.children.length"
                class="font-mono text-[11px] text-muted"
              >{{ progress(gc.children) }}</span>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-plus"
                class="opacity-0 group-hover:opacity-100"
                title="Add subtask"
                @click="openSubtask(String(gc.id))"
              />
            </div>

            <!-- Great-grandchildren -->
            <div
              v-for="ggc in gc.children"
              :key="String(ggc.id)"
              class="flex items-center gap-2.5 border-b border-default/60 bg-muted/60 py-[9px] pl-[60px] pr-3 last:border-b-0"
            >
              <TodoStatusDot :status="ggc.status" />
              <NuxtLink
                :to="`/tools/todo/${ggc.id}`"
                class="truncate text-[13px] text-highlighted hover:underline"
              >
                {{ ggc.name }}
              </NuxtLink>
              <span
                v-if="ggc.owner"
                class="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted"
              >{{ ownerLabel(ggc.owner) }}</span>
              <span class="flex-1" />
              <span
                v-if="ggc.hiddenChildrenCount > 0"
                class="shrink-0 font-mono text-[11px] text-muted"
              >
                +{{ ggc.hiddenChildrenCount }} more
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </section>

  <!-- Add Subtask Modal -->
  <UModal
    v-model:open="showSubtaskModal"
    title="Add Subtask"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField
          label="Name"
          required
        >
          <UInput
            v-model="subtaskName"
            placeholder="Subtask name…"
            class="w-full"
            autofocus
            @keyup.enter="saveSubtask"
            @keyup.escape="showSubtaskModal = false"
          />
        </UFormField>
        <div class="flex gap-3">
          <UButton
            :disabled="!subtaskName.trim()"
            @click="saveSubtask"
          >
            Add
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
            @click="showSubtaskModal = false"
          >
            Cancel
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
