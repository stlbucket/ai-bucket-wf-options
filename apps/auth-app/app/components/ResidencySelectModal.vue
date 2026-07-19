<script setup lang="ts">
import type { ResidencyTreeNode } from '@function-bucket/fnb-types'

// Fed from ProfileClaims.residencies (ghost nodes filtered out by the caller, so residentId is
// always set here — the ?? '' is a type-level fallback only).
const props = defineProps<{
  open: boolean
  residencies: ResidencyTreeNode[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [residentId: string]
}>()

const selected = ref<string>(props.residencies[0]?.residentId ?? '')

const items = computed(() =>
  props.residencies.map((r) => ({ value: r.residentId ?? '', label: r.tenantName })),
)
</script>

<template>
  <UModal
    :open="open"
    title="Select your workspace"
    :dismissible="false"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted">Choose which workspace you'd like to enter.</p>
        <URadioGroup v-model="selected" :items="items" />
        <UButton block :loading="loading" :disabled="!selected" @click="emit('select', selected)">
          Continue
        </UButton>
      </div>
    </template>
  </UModal>
</template>
