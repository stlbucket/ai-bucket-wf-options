<script setup lang="ts">
import type { PollDetailView } from '@function-bucket/fnb-graphql-client-api'
import type { ResultsVisibility } from '@function-bucket/fnb-types'

const props = defineProps<{ poll: PollDetailView }>()
const emit = defineEmits<{
  (
    e: 'save',
    payload: {
      allowChangeAfterSubmit: boolean
      resultsVisibility: ResultsVisibility
      closesAt: Date | null
    },
  ): void
}>()

const open = ref(false)
const allowChange = ref(props.poll.allowChangeAfterSubmit)
const visibility = ref<ResultsVisibility>(props.poll.resultsVisibility)
const closesAtLocal = ref(toLocal(props.poll.closesAt))

function toLocal(d: Date | null): string {
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

watch(open, (v) => {
  if (v) {
    allowChange.value = props.poll.allowChangeAfterSubmit
    visibility.value = props.poll.resultsVisibility
    closesAtLocal.value = toLocal(props.poll.closesAt)
  }
})

const visibilityItems = [
  { label: 'Hidden — members see only their own answers', value: 'HIDDEN' },
  { label: 'Aggregate — counts only, no names', value: 'AGGREGATE' },
  { label: 'Attributed — show who answered what', value: 'ATTRIBUTED' },
]

function save() {
  emit('save', {
    allowChangeAfterSubmit: allowChange.value,
    resultsVisibility: visibility.value,
    closesAt: closesAtLocal.value ? new Date(closesAtLocal.value) : null,
  })
  open.value = false
}
</script>

<template>
  <UButton icon="i-lucide-settings" variant="outline" color="neutral" size="sm" @click="open = true">
    Settings
  </UButton>

  <UModal v-model:open="open" title="Poll settings">
    <template #body>
      <div class="flex flex-col gap-5">
        <UFormField
          label="Allow changes after submitting"
          description="When off, a member's answers lock once they submit."
        >
          <USwitch v-model="allowChange" />
        </UFormField>

        <UFormField label="Results visibility">
          <URadioGroup v-model="visibility" :items="visibilityItems" />
        </UFormField>

        <UFormField label="Closes at" description="Optional — leave empty for no close date.">
          <UInput v-model="closesAtLocal" type="datetime-local" class="w-full" />
        </UFormField>

        <div class="flex gap-3">
          <UButton @click="save">Save</UButton>
          <UButton variant="ghost" color="neutral" @click="open = false">Cancel</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
