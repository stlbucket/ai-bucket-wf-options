<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const todoId = String(route.params.id)

const {
  todoTree,
  parentChain,
  residents,
  fetching,
  updateTodo,
  updateStatus,
  deleteTodo,
  addSubtask,
  makeTemplate,
  cloneTemplate,
  assignResident,
  pinTodo,
  unpinTodo
} = useTodoDetail(todoId)

// Attachments are not part of the todo tree — asset refresh never reloads TodoById, and todo
// mutations never touch this list ([id].data.md → Attachments). Addressed by the todo's URN
// (stacking v2); the query pauses until the todo query resolves it.
const { assets, refresh: refreshAssets } = useSubjectAssets(
  computed(() => todoTree.value?.urn ?? null)
)
const { remove: removeAsset, error: deleteAssetError } = useAssetDelete()

async function handleUpdateTodo(name: string, description: string | null) {
  try {
    await updateTodo(name, description)
    toast.add({ title: 'Saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save', color: 'error' })
  }
}

async function handleUpdateStatus(targetTodoId: string, status: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateStatus(targetTodoId, status as any)
  } catch {
    toast.add({ title: 'Failed to update status', color: 'error' })
  }
}

async function handleDelete() {
  try {
    await deleteTodo()
    await navigateTo('/tools/todo')
  } catch {
    toast.add({ title: 'Failed to delete todo', color: 'error' })
  }
}

async function handleAddSubtask(name: string, parentId: string) {
  try {
    await addSubtask(name, parentId)
  } catch {
    toast.add({ title: 'Failed to add subtask', color: 'error' })
  }
}

async function handleMakeTemplate() {
  try {
    const newId = await makeTemplate()
    if (newId) await navigateTo(`/tools/todo/${newId}`)
  } catch {
    toast.add({ title: 'Failed to make template', color: 'error' })
  }
}

async function handleCloneTemplate() {
  try {
    const newId = await cloneTemplate()
    if (newId) await navigateTo(`/tools/todo/${newId}`)
  } catch {
    toast.add({ title: 'Failed to clone template', color: 'error' })
  }
}

async function handleAssignResident(residentUrn: string) {
  try {
    await assignResident(residentUrn)
    toast.add({ title: 'Assigned', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to assign', color: 'error' })
  }
}

async function handlePin() {
  try {
    await pinTodo()
  } catch {
    toast.add({ title: 'Failed to pin', color: 'error' })
  }
}

async function handleUnpin() {
  try {
    await unpinTodo()
  } catch {
    toast.add({ title: 'Failed to unpin', color: 'error' })
  }
}

// 202 accepted — the uploader already toasted; the scan verdict lands later (row shows PENDING).
function handleUploaded() {
  refreshAssets()
}

async function handleDeleteAsset(assetId: string) {
  try {
    await removeAsset(assetId)
    refreshAssets()
  } catch {
    toast.add({ title: deleteAssetError.value ?? 'Delete failed', color: 'error' })
  }
}
</script>

<template>
  <ClientOnly>
    <div class="flex w-full flex-col gap-4 p-6 sm:p-9">
      <div
        v-if="fetching"
        class="py-8 text-center text-sm text-muted"
      >
        Loading…
      </div>

      <template v-else-if="todoTree">
        <div class="hidden md:block">
          <TodoDetail
            :todo-tree="todoTree"
            :residents="residents"
            :parent-chain="parentChain"
            :assets="assets"
            @update-todo="handleUpdateTodo"
            @update-status="handleUpdateStatus"
            @delete="handleDelete"
            @add-subtask="handleAddSubtask"
            @make-template="handleMakeTemplate"
            @clone-template="handleCloneTemplate"
            @assign-resident="handleAssignResident"
            @pin="handlePin"
            @unpin="handleUnpin"
            @uploaded="handleUploaded"
            @delete-asset="handleDeleteAsset"
          />
        </div>
        <div class="block md:hidden">
          <TodoDetailSmall
            :todo-tree="todoTree"
            :residents="residents"
            :parent-chain="parentChain"
            :assets="assets"
            @update-todo="handleUpdateTodo"
            @update-status="handleUpdateStatus"
            @delete="handleDelete"
            @add-subtask="handleAddSubtask"
            @make-template="handleMakeTemplate"
            @clone-template="handleCloneTemplate"
            @assign-resident="handleAssignResident"
            @pin="handlePin"
            @unpin="handleUnpin"
            @uploaded="handleUploaded"
            @delete-asset="handleDeleteAsset"
          />
        </div>
      </template>

      <div
        v-else
        class="text-sm text-muted"
      >
        Todo not found.
      </div>
    </div>
  </ClientOnly>
</template>
