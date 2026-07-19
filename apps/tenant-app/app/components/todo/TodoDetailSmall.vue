<script lang="ts" setup>
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Asset, AssetMeta } from '@function-bucket/fnb-types'
import type { TodoNode } from '~/composables/useTodoDetail'

type TodoResident = {
  residentId: any
  displayName: string
  tenantId: any
}

type BreadcrumbItem = {
  id: string
  name: string
}

const props = defineProps<{
  todoTree: TodoNode
  residents: TodoResident[]
  parentChain: BreadcrumbItem[]
  assets: Asset[]
}>()

const emit = defineEmits<{
  (e: 'update-todo', name: string, description: string | null): void
  (e: 'update-status', todoId: string, status: string): void
  (e: 'delete'): void
  (e: 'add-subtask', name: string, parentId: string): void
  (e: 'make-template'): void
  (e: 'clone-template'): void
  (e: 'assign-resident', residentId: string): void
  (e: 'pin'): void
  (e: 'unpin'): void
  (e: 'uploaded', asset: AssetMeta): void
  (e: 'delete-asset', assetId: string): void
}>()

// Breadcrumb collapses to the immediate parent only.
const parent = computed(() => props.parentChain[props.parentChain.length - 1] ?? null)

// Inline name editing
const editingName = ref(false)
const draftName = ref('')

function startEditName() {
  draftName.value = props.todoTree.name
  editingName.value = true
}

function saveName() {
  const n = draftName.value.trim()
  if (n && n !== props.todoTree.name) {
    emit('update-todo', n, props.todoTree.description ?? null)
  }
  editingName.value = false
}

// Status dropdown pill
const statusOptions = [
  { label: 'Incomplete', value: 'INCOMPLETE' },
  { label: 'Complete', value: 'COMPLETE' },
  { label: 'Unfinished', value: 'UNFINISHED' },
  { label: 'Archived', value: 'ARCHIVED' },
]
const statusItems = computed<DropdownMenuItem[]>(() =>
  statusOptions.map((opt) => ({
    label: opt.label,
    onSelect: () => emit('update-status', String(props.todoTree.id), opt.value),
  })),
)

// Bottom accordions
const attachmentsOpen = ref(false)
const discussionOpen = ref(false)
</script>

<template>
  <UCard :ui="{ header: 'p-4', body: 'p-4' }">
    <template #header>
      <div class="flex flex-col gap-2">
        <!-- Collapsed breadcrumb -->
        <NuxtLink
          v-if="parent"
          :to="`/tools/todo/${parent.id}`"
          class="flex items-center gap-1 text-xs text-muted hover:text-primary"
        >
          <UIcon name="i-lucide-chevron-left" class="size-3.5 shrink-0" />
          <span class="truncate">{{ parent.name }}</span>
        </NuxtLink>

        <!-- Title row -->
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div v-if="editingName" class="flex items-center gap-1">
              <UInput
                v-model="draftName"
                size="sm"
                class="flex-1"
                autofocus
                @keyup.enter="saveName"
                @keyup.escape="editingName = false"
              />
              <UButton size="xs" @click="saveName">Save</UButton>
              <UButton size="xs" variant="ghost" color="neutral" @click="editingName = false">✕</UButton>
            </div>
            <div v-else class="flex flex-wrap items-center gap-2">
              <h1 class="text-lg font-semibold cursor-pointer" @click="startEditName">
                {{ todoTree.name }}
              </h1>
              <TodoDetailBadges
                :type="todoTree.type"
                :pinned="todoTree.pinned"
                :is-template="todoTree.isTemplate"
              />
            </div>
          </div>
          <TodoDetailActions
            :is-template="todoTree.isTemplate"
            :pinned="todoTree.pinned"
            :todo-name="todoTree.name"
            @make-template="emit('make-template')"
            @clone-template="emit('clone-template')"
            @pin="emit('pin')"
            @unpin="emit('unpin')"
            @delete="emit('delete')"
          />
        </div>

        <!-- Meta chips -->
        <div class="flex flex-wrap items-center gap-2">
          <UDropdownMenu :items="statusItems">
            <UButton
              :color="statusColor('todo', todoTree.status)"
              variant="subtle"
              size="sm"
              class="min-h-8"
              trailing-icon="i-lucide-chevron-down"
            >
              {{ statusLabel(todoTree.status) }}
            </UButton>
          </UDropdownMenu>
          <TodoDetailAssign
            :owner="todoTree.owner"
            :residents="residents"
            @assign-resident="emit('assign-resident', $event)"
          />
          <TodoDetailLocation />
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-5">
      <TodoDetailDescription
        :description="todoTree.description"
        @update="(desc) => emit('update-todo', todoTree.name, desc)"
      />

      <TodoDetailSubtasks
        :todo-id="todoTree.id"
        :children="todoTree.children"
        @add-subtask="(name, parentId) => emit('add-subtask', name, parentId)"
      />

      <!-- Accordion rail -->
      <div class="flex flex-col gap-2">
        <!-- Attachments -->
        <div class="overflow-hidden rounded-lg border border-default bg-muted">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            @click="attachmentsOpen = !attachmentsOpen"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 shrink-0 text-muted transition-transform"
              :class="attachmentsOpen ? 'rotate-90' : ''"
            />
            <span class="text-[13px] font-semibold text-highlighted">Attachments</span>
          </button>
          <div v-if="attachmentsOpen" class="border-t border-default bg-default p-3">
            <TodoDetailAttachments
              :todo-urn="String(todoTree.urn)"
              :assets="assets"
              @uploaded="emit('uploaded', $event)"
              @delete-asset="emit('delete-asset', $event)"
            />
          </div>
        </div>

        <!-- Discussion -->
        <div class="overflow-hidden rounded-lg border border-default bg-muted">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            @click="discussionOpen = !discussionOpen"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 shrink-0 text-muted transition-transform"
              :class="discussionOpen ? 'rotate-90' : ''"
            />
            <span class="text-[13px] font-semibold text-highlighted">Discussion</span>
          </button>
          <div v-if="discussionOpen" class="border-t border-default bg-default p-3">
            <TodoMsg :todo-urn="String(todoTree.urn)" :todo-name="todoTree.name" />
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
