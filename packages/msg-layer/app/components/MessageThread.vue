<script lang="ts" setup>
import type { MsgMessage } from '@function-bucket/fnb-graphql-client-api'

defineProps<{ messages: MsgMessage[] }>()
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="message in messages"
      :key="message.id"
      class="rounded-lg border border-default px-4 py-3 flex flex-col gap-1"
    >
      <span class="text-xs text-muted">{{ new Date(message.createdAt).toLocaleString() }}</span>
      <p class="text-sm whitespace-pre-wrap">{{ message.content }}</p>
    </div>
    <p v-if="!messages.length" class="text-sm text-muted">No messages yet. Be the first to post!</p>
  </div>
</template>
