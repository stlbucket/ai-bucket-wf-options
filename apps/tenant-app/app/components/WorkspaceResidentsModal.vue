<script setup lang="ts">
// Workspace-only "Manage Residents" action (admin/user spec). Self-contained trigger + modal,
// mirroring InviteUserModal/WorkspaceCreateModal. Lists everyone in the current workspace's tenant
// tree with a checkbox per person: checking adds them to THIS workspace (guest + app-user license),
// unchecking soft-removes them. The pool query is paused until the modal is opened.
const emit = defineEmits<{ (e: 'changed'): void }>()

const open = ref(false)
const paused = computed(() => !open.value)
const { candidates, fetching, error, setMembership } = useWorkspaceResidents(paused)
const { user } = useAuth()
const toast = useToast()

const myProfileId = computed(() => user.value?.profileId ?? null)
const pendingIds = ref<Set<string>>(new Set())

async function toggle(profileId: string, next: boolean, name: string) {
  if (pendingIds.value.has(profileId)) return
  pendingIds.value = new Set(pendingIds.value).add(profileId)
  try {
    await setMembership(profileId, next)
    toast.add({
      title: next ? `Added ${name}` : `Removed ${name}`,
      color: 'success',
      icon: next ? 'i-lucide-user-check' : 'i-lucide-user-minus',
    })
    emit('changed')
  } catch (err) {
    toast.add({ title: 'Could not update membership', description: mapError(err), color: 'error' })
  } finally {
    const nextSet = new Set(pendingIds.value)
    nextSet.delete(profileId)
    pendingIds.value = nextSet
  }
}

function mapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/not authenticated|\b401\b/i.test(msg)) return 'Your session has expired — please sign in again.'
  if (/\b31010\b|remove self/i.test(msg)) return 'You cannot remove yourself from the workspace.'
  if (/not authorized|\b30000\b|p:app-admin/i.test(msg)) return 'You do not have permission to do that.'
  return msg || 'Something went wrong. Please try again.'
}
</script>

<template>
  <UButton
    icon="i-lucide-users-round"
    size="sm"
    variant="soft"
    @click="open = true"
  >
    Manage Residents
  </UButton>

  <UModal
    v-model:open="open"
    title="Manage Residents"
    description="Add or remove people across this workspace's tenant tree. Checked people are members of this workspace."
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <div
          v-if="fetching"
          class="py-8 text-center text-sm text-muted"
        >
          Loading residents…
        </div>

        <UAlert
          v-else-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Could not load residents"
          :description="error.message"
        />

        <UEmpty
          v-else-if="candidates.length === 0"
          icon="i-lucide-users"
          label="No residents in this tenant tree yet"
        />

        <ul
          v-else
          class="max-h-96 divide-y divide-default overflow-y-auto"
        >
          <li
            v-for="c in candidates"
            :key="c.profileId"
            class="flex items-center gap-3 py-2.5"
          >
            <UCheckbox
              :model-value="c.isMember"
              :disabled="c.profileId === myProfileId || pendingIds.has(c.profileId)"
              @update:model-value="(v: boolean) => toggle(c.profileId, v, c.displayName)"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium">{{ c.displayName }}</span>
                <UBadge
                  v-if="c.profileId === myProfileId"
                  size="xs"
                  color="neutral"
                  variant="subtle"
                >
                  you
                </UBadge>
              </div>
              <span class="truncate text-xs text-muted">{{ c.email }}</span>
            </div>
            <UBadge
              v-if="c.homeTenantName"
              size="xs"
              color="neutral"
              variant="soft"
            >
              {{ c.homeTenantName }}
            </UBadge>
          </li>
        </ul>

        <div class="flex justify-end">
          <UButton
            variant="ghost"
            color="neutral"
            @click="open = false"
          >
            Done
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
