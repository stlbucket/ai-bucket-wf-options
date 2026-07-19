<script lang="ts" setup>
import type { SubscribedTopicSummary } from '@function-bucket/fnb-graphql-client-api'

defineProps<{ topics: SubscribedTopicSummary[] }>()
</script>

<template>
  <div v-if="topics.length" class="flex flex-col gap-2">
    <NuxtLink
      v-for="topic in topics"
      :key="topic.id"
      :to="`/messages/${topic.id}`"
      class="flex items-center justify-between rounded-lg border border-default px-4 py-3 hover:bg-elevated transition-colors"
    >
      <div class="flex flex-col gap-1">
        <span class="font-medium text-sm">{{ topic.name }}</span>
        <span class="text-xs text-muted">{{ new Date(topic.createdAt).toLocaleDateString() }}</span>
      </div>
      <div class="flex items-center gap-2">
        <UBadge :color="statusColor('topic', topic.status)" variant="subtle" size="sm">
          {{ statusLabel(topic.status) }}
        </UBadge>
        <UIcon name="i-lucide-chevron-right" class="text-muted" />
      </div>
    </NuxtLink>
  </div>
  <p v-else class="text-sm text-muted">No topics yet. Start a new discussion!</p>
</template>
