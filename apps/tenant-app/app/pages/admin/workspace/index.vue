<script setup lang="ts">
import type { WorkspaceView } from '@function-bucket/fnb-graphql-client-api'
import { useWorkspaces } from '~/composables/useWorkspaces'

const toast = useToast()
const { user, refreshClaims } = useAuth()

const { workspaces, createWorkspace, enterWorkspace } = useWorkspaces()

const creating = ref(false)
const enteringId = ref<string | null>(null)
const createModal = ref<{ reset: () => void } | null>(null)

async function onCreate(name: string, identifier?: string) {
  creating.value = true
  try {
    const created = await createWorkspace(name, identifier)
    createModal.value?.reset()
    toast.add({ title: `Workspace ${created.name} created`, color: 'success' })
  } catch (e) {
    const message = e instanceof Error && e.message.includes('30002')
      ? 'A workspace with this name already exists'
      : 'Failed to create workspace'
    toast.add({ title: message, color: 'error' })
  } finally {
    creating.value = false
  }
}

async function onEnter(workspace: WorkspaceView) {
  if (!workspace.myResidentId) return
  enteringId.value = workspace.id
  try {
    await enterWorkspace(workspace.myResidentId)
    await refreshClaims()
    toast.add({ title: `Entered ${workspace.name}`, color: 'success' })
    navigateTo('/', { external: true })
  } catch {
    enteringId.value = null
    toast.add({ title: 'Failed to enter workspace', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <PageHeader
        title="Workspaces"
        :subtitle="`${workspaces.length} nested workspaces of ${user?.tenantName ?? 'this tenant'}`"
      />
      <WorkspaceCreateModal
        ref="createModal"
        :creating="creating"
        @create="onCreate"
      />
    </div>
    <div class="overflow-hidden rounded-[10px] border border-default bg-default">
      <WorkspaceList
        :workspaces="workspaces"
        :entering-id="enteringId"
        @enter="onEnter"
      />
    </div>
  </div>
</template>
