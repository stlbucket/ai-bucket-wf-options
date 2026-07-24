<script setup lang="ts">
import type { PollListItem } from '@function-bucket/fnb-graphql-client-api'

defineProps<{ polls: PollListItem[] }>()

const statusColor = (s: string) => (s === 'OPEN' ? 'success' : s === 'DRAFT' ? 'neutral' : 'info')
</script>

<template>
  <div class="divide-y divide-default">
    <ULink
      v-for="p in polls"
      :key="p.id"
      :to="`/tools/poll/${p.id}`"
      class="flex flex-col gap-1 py-3"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="font-medium text-highlighted">{{ p.title }}</span>
        <UBadge :color="statusColor(p.status)" variant="subtle" size="sm">
          {{ p.status.toLowerCase() }}
        </UBadge>
      </div>
      <div class="flex items-center gap-2 text-xs text-muted">
        <span>{{ p.questionCount }} question{{ p.questionCount === 1 ? '' : 's' }}</span>
        <span>·</span>
        <UBadge
          v-if="p.answered"
          color="success"
          variant="subtle"
          size="sm"
        >
          Answered
        </UBadge>
        <UBadge v-else-if="p.responseInProgress" color="info" variant="subtle" size="sm">
          In progress
        </UBadge>
        <UBadge v-else color="warning" variant="subtle" size="sm">Not answered</UBadge>
      </div>
    </ULink>
  </div>
</template>
