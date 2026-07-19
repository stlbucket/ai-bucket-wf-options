<script lang="ts" setup>
defineProps<{
  type: string
  pinned: boolean
  isTemplate: boolean
}>()
</script>

<template>
  <div class="flex items-center gap-1.5">
    <UBadge
      v-if="type === 'MILESTONE'"
      color="info"
      variant="subtle"
      size="sm"
    >
      milestone
    </UBadge>
    <UBadge
      v-if="pinned"
      color="neutral"
      variant="outline"
      size="sm"
      icon="i-lucide-pin"
    >
      pinned
    </UBadge>
    <UBadge
      v-if="isTemplate"
      color="neutral"
      variant="outline"
      size="sm"
    >
      template
    </UBadge>
  </div>
</template>
