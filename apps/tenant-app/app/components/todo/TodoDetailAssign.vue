<script lang="ts" setup>
type TodoOwner = {
  residentId: any
  displayName: string
}

type TodoResident = {
  residentId: any
  urn: string
  displayName: string
  tenantId: any
}

const props = defineProps<{
  owner?: TodoOwner | null
  residents: TodoResident[]
}>()

const emit = defineEmits<{
  (e: 'assign-resident', residentUrn: string): void
}>()

const residentOptions = computed(() =>
  props.residents.map(r => ({ label: r.displayName, value: r.urn }))
)
const selectedResident = ref<string | null>(null)
const open = ref(false)

const initials = computed(() => {
  const name = props.owner?.displayName?.trim()
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('')
})

function assignResident() {
  if (selectedResident.value) {
    emit('assign-resident', selectedResident.value)
    selectedResident.value = null
    open.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <span
      class="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
      :class="!owner ? 'text-muted' : ''"
    >
      {{ initials }}
    </span>
    <span class="text-[13px] text-highlighted">{{ owner?.displayName ?? 'Unassigned' }}</span>
    <UPopover v-model:open="open">
      <button
        type="button"
        class="text-[11px] text-muted underline underline-offset-2 hover:text-default"
      >
        change
      </button>
      <template #content>
        <div class="flex flex-col gap-2 p-3">
          <USelectMenu
            v-model="selectedResident"
            :items="residentOptions"
            placeholder="Assign resident…"
            size="sm"
            class="w-56"
            value-attribute="value"
            option-attribute="label"
          />
          <UButton
            size="sm"
            block
            :disabled="!selectedResident"
            @click="assignResident"
          >
            Assign
          </UButton>
        </div>
      </template>
    </UPopover>
  </div>
</template>
