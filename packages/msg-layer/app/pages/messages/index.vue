<script setup lang="ts">
const { topics, createTopic: doCreate } = useMsgTopics()

const newTopicOpen = ref(false)
const newTopicName = ref('')
const creating = ref(false)
const toast = useToast()

async function createTopic() {
  if (!newTopicName.value.trim()) return
  creating.value = true
  try {
    await doCreate(newTopicName.value)
    newTopicName.value = ''
    newTopicOpen.value = false
  } catch {
    toast.add({ title: 'Failed to create topic', color: 'error' })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Discussions</h1>
      <UButton icon="i-lucide-plus" size="sm" @click="newTopicOpen = true">
        New Topic
      </UButton>
    </div>

    <UModal v-model:open="newTopicOpen" title="New Topic">
      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField label="Topic name" required>
            <UInput v-model="newTopicName" placeholder="Enter topic name…" class="w-full" />
          </UFormField>
          <div class="flex gap-3">
            <UButton :loading="creating" :disabled="!newTopicName.trim()" @click="createTopic">
              Create
            </UButton>
            <UButton variant="ghost" color="neutral" @click="newTopicOpen = false">
              Cancel
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <TopicList :topics="topics" />
  </div>
</template>
