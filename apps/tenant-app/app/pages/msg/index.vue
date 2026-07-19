<script setup lang="ts">
definePageMeta({ ssr: false })

const router = useRouter()
const toast = useToast()
const { user } = useAuth()

const currentResidentId = computed(() => user.value?.residentId)
const { topics, createTopic } = useMsgTopics(currentResidentId)

const search = ref('')
const filteredTopics = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return topics.value
  return topics.value.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.participantNames.some((n) => n.toLowerCase().includes(q)),
  )
})

async function handleCreate(name: string, participantUrns: string[], initialMessage: string) {
  try {
    const topic = await createTopic(name, participantUrns, initialMessage)
    await router.push(`/msg/${topic.id}`)
  } catch {
    toast.add({ title: 'Failed to create conversation', color: 'error' })
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h1 class="text-lg font-semibold">Messages</h1>
          <MsgNewConversationModal @create="handleCreate" />
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search by topic or participant…"
          class="w-64"
          :trailing-icon="search ? 'i-lucide-x' : undefined"
          @click:trailing="search = ''"
        />

        <UEmpty
          v-if="!filteredTopics.length && search"
          icon="i-lucide-search-x"
          label="No topics match the current search."
        />
        <UEmpty
          v-else-if="!topics.length"
          icon="i-lucide-messages-square"
          label="You are not subscribed to any open topics."
        />
        <MsgTopicList v-else :topics="filteredTopics" />
      </div>
    </UCard>
  </div>
</template>
