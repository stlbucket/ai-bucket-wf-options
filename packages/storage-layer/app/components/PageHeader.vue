<script setup lang="ts">
// Duplicated from apps/tenant-app/app/components/PageHeader.vue — it lives in the app, not
// tenant-layer, so storage-layer doesn't inherit it (assets-page.ui.md open question resolved).
defineProps<{ title: string, subtitle?: string }>()
</script>

<template>
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-[22px] font-bold text-highlighted">{{ title }}</h1>
      <p v-if="subtitle" class="mt-0.5 text-sm text-muted">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>
