<script lang="ts" setup>
// Status indicator dot for subtask rows (replaces the text status badge).
//  - COMPLETE:   filled emerald with white check
//  - INCOMPLETE: gray ring, empty
//  - UNFINISHED: amber dashed ring
//  - ARCHIVED / other: neutral ring
const props = defineProps<{
  status: string
}>()

const normalized = computed(() => props.status?.trim().toUpperCase())
</script>

<template>
  <span class="inline-flex size-4 shrink-0 items-center justify-center">
    <span
      v-if="normalized === 'COMPLETE'"
      class="flex size-4 items-center justify-center rounded-full bg-success text-inverted"
    >
      <UIcon name="i-lucide-check" class="size-2.5" />
    </span>
    <span
      v-else-if="normalized === 'UNFINISHED'"
      class="size-4 rounded-full border-2 border-dashed border-warning"
    />
    <span
      v-else
      class="size-4 rounded-full border-2"
      :class="normalized === 'ARCHIVED' ? 'border-muted' : 'border-default'"
    />
  </span>
</template>
