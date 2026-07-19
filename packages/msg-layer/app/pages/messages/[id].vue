<script setup lang="ts">
const route = useRoute()
const topicId = route.params.id as string

const { topic, messages } = useTopicMessages(topicId)
</script>

<template>
  <div class="flex flex-col gap-4 h-full">
    <div class="flex items-center gap-2">
      <UButton variant="ghost" color="neutral" icon="i-lucide-arrow-left" to="/messages" size="sm">
        Topics
      </UButton>
    </div>

    <h1 class="text-xl font-semibold">{{ topic?.name ?? 'Topic' }}</h1>

    <div class="flex-1 overflow-y-auto">
      <MessageThread :messages="messages" />
    </div>

    <MessageComposer :topic-id="topicId" />
  </div>
</template>
