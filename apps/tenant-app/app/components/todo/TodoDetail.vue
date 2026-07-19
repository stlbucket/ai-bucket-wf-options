<script lang="ts" setup>
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

// Right rail visibility — persisted per user. The page mounts this under
// <ClientOnly>, so localStorage is always available here.
const railOpen = ref(true)
onMounted(() => {
  const saved = localStorage.getItem('todo-detail-rail-open')
  if (saved !== null) railOpen.value = saved === 'true'
})
watch(railOpen, (v) => localStorage.setItem('todo-detail-rail-open', String(v)))
</script>

<template>
  <UCard
    class="w-full"
    :ui="{ body: 'p-0 sm:p-0' }"
  >
    <template #header>
      <div class="flex flex-col gap-2.5">
        <TodoDetailBreadcrumb :parent-chain="parentChain" />

        <!-- Title row -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex min-w-0 flex-1 items-center gap-2.5">
            <TodoDetailName
              :name="todoTree.name"
              @update="(name) => emit('update-todo', name, todoTree.description ?? null)"
            />
            <TodoDetailBadges
              :type="todoTree.type"
              :pinned="todoTree.pinned"
              :is-template="todoTree.isTemplate"
            />
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <UButton
              variant="outline"
              color="neutral"
              size="sm"
              class="whitespace-nowrap"
              :trailing-icon="railOpen ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right-open'"
              @click="railOpen = !railOpen"
            >
              Attachments · Discussion
            </UButton>
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
        </div>

        <!-- Meta row -->
        <div class="flex flex-wrap items-center gap-3.5">
          <TodoDetailStatus
            :todo-id="todoTree.id"
            :status="todoTree.status"
            @update-status="(todoId, status) => emit('update-status', todoId, status)"
          />
          <span class="h-[18px] w-px bg-[var(--ui-border)]" />
          <TodoDetailAssign
            :owner="todoTree.owner"
            :residents="residents"
            @assign-resident="emit('assign-resident', $event)"
          />
          <span class="h-[18px] w-px bg-[var(--ui-border)]" />
          <TodoDetailLocation />
        </div>
      </div>
    </template>

    <!-- Body -->
    <div class="flex min-h-[24rem] items-stretch">
      <!-- Main column -->
      <div class="flex min-w-0 flex-1 flex-col gap-6 p-5 sm:px-6">
        <TodoDetailDescription
          :description="todoTree.description"
          @update="(desc) => emit('update-todo', todoTree.name, desc)"
        />
        <TodoDetailSubtasks
          :todo-id="todoTree.id"
          :children="todoTree.children"
          @add-subtask="(name, parentId) => emit('add-subtask', name, parentId)"
        />
      </div>

      <!-- Right rail -->
      <aside
        v-if="railOpen"
        class="flex w-80 shrink-0 flex-col gap-5 border-l border-default bg-muted p-[18px]"
      >
        <TodoDetailAttachments
          :todo-urn="String(todoTree.urn)"
          :assets="assets"
          @uploaded="emit('uploaded', $event)"
          @delete-asset="emit('delete-asset', $event)"
        />
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Discussion
          </div>
          <TodoMsg
            :todo-urn="String(todoTree.urn)"
            :todo-name="todoTree.name"
          />
        </div>
      </aside>
    </div>
  </UCard>
</template>
