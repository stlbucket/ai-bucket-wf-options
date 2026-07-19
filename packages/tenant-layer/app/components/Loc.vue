<script setup lang="ts">
import type { Location } from '@function-bucket/fnb-types'

const props = defineProps<{ location: Location }>()

const addressLines = computed(() => {
  const { address1, address2, city, state, postalCode, country } = props.location
  const lines: string[] = []
  if (address1) lines.push(address1)
  if (address2) lines.push(address2)
  const cityLine = [city, state, postalCode].filter(Boolean).join(', ')
  if (cityLine) lines.push(cityLine)
  if (country) lines.push(country)
  return lines
})

const hasCoords = computed(() => props.location.lat != null && props.location.lon != null)
</script>

<template>
  <div class="flex flex-col gap-2">
    <p v-if="location.name" class="text-base font-semibold">{{ location.name }}</p>

    <div v-if="addressLines.length" class="flex flex-col gap-0.5">
      <p v-for="(line, i) in addressLines" :key="i" class="text-sm text-muted">{{ line }}</p>
    </div>

    <p v-if="hasCoords" class="text-xs text-muted">
      {{ location.lat }}, {{ location.lon }}
    </p>
  </div>
</template>
