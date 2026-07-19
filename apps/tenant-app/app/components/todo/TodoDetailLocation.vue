<script lang="ts" setup>
// Placeholder — static location data until the loc API is wired up.
// Source row: loc.location (Seattle, WA).
const location = {
  name: 'Seattle, WA',
  city: 'Seattle',
  state: 'WA',
  country: 'US',
  lat: 47.613833,
  lon: -122.33875
}

const open = ref(false)
</script>

<template>
  <UPopover v-model:open="open">
    <button
      type="button"
      class="flex items-center gap-1 text-[13px] text-highlighted"
    >
      <UIcon name="i-lucide-map-pin" class="size-3.5 text-muted" />
      <span class="underline decoration-dotted underline-offset-2">{{ location.name }}</span>
    </button>
    <template #content>
      <div class="w-[260px]">
        <!-- Map preview (placeholder) -->
        <div
          class="flex h-[130px] items-center justify-center rounded-t-[calc(var(--ui-radius)*1.5)] bg-gradient-to-br from-emerald-100 to-sky-100 dark:from-emerald-950 dark:to-sky-950"
        >
          <UIcon name="i-lucide-map-pin" class="size-7 text-primary" />
        </div>
        <div class="flex items-center gap-2 px-3 py-2.5">
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs font-semibold text-highlighted">{{ location.name }}</div>
            <div class="font-mono text-[10px] text-muted">{{ location.lat }}, {{ location.lon }}</div>
          </div>
          <button
            type="button"
            class="shrink-0 text-[11px] font-semibold text-primary hover:underline"
          >
            Change
          </button>
        </div>
      </div>
    </template>
  </UPopover>
</template>
