<script setup lang="ts">
import { formatUrn } from '@function-bucket/fnb-types'

const props = defineProps<{
  pollUrn: string
  pollTitle: string
}>()

const toast = useToast()
const { user } = useAuth()
const currentResidentId = computed(() => user.value?.residentId ?? '')
const currentResidentUrn = computed(() => {
  const u = user.value
  if (!u?.residentId || !u?.tenantId) return ''
  return formatUrn({ tenantId: u.tenantId, module: 'app', resourceType: 'resident', id: u.residentId })
})

const { topic, fetching, startDiscussion } = usePollMsg(() => props.pollUrn)
const topicCreated = ref(false)

async function handleCreate(name: string, _participantUrns: string[], initialMessage: string) {
  try {
    const participants = currentResidentUrn.value ? [currentResidentUrn.value] : []
    await startDiscussion(name, participants, initialMessage)
    topicCreated.value = true
  } catch {
    toast.add({ title: 'Failed to start discussion', color: 'error' })
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="fetching" class="text-sm text-muted py-2">Loading…</div>

    <template v-else-if="topic">
      <Msg
        class="flex min-h-0 w-full flex-1"
        hide-header
        :topic-id="topic.id"
        :current-resident-id="currentResidentId"
      />
    </template>

    <div v-else-if="topicCreated" class="text-sm text-muted py-2">Loading…</div>

    <div v-else class="flex items-center gap-2.5 py-2">
      <span class="text-xs text-dimmed">No discussion yet.</span>
      <MsgNewConversationModal hide-participants :topic-name="pollTitle" @create="handleCreate">
        <template #trigger="{ open }">
          <UButton variant="outline" color="neutral" size="xs" @click="open">
            Start discussion
          </UButton>
        </template>
      </MsgNewConversationModal>
    </div>
  </div>
</template>
