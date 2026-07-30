<script lang="ts" setup>
import type { TodoAssigneeView } from '~/composables/useTodoDetail'

type TodoResident = {
  residentId: any
  urn: string
  displayName: string
  tenantId: any
}

type ResidentOption = { label: string, value: string }

const props = defineProps<{
  assignees: TodoAssigneeView[]
  residents: TodoResident[]
}>()

const emit = defineEmits<{
  (e: 'add-assignee', residentUrn: string): void
  (e: 'remove-assignee', residentUrn: string): void
}>()

const residentOptions = computed<ResidentOption[]>(() =>
  props.residents.map(r => ({ label: r.displayName, value: r.urn }))
)

const open = ref(false)
const selected = ref<ResidentOption[]>([])

// Seed the multi-select with the current assignees each time the popover opens,
// so deselecting an assigned resident reads as removal.
watch(open, (isOpen) => {
  if (isOpen) {
    selected.value = residentOptions.value.filter(o =>
      props.assignees.some(a => a.residentUrn === o.value)
    )
  }
})

// Diff the selection against the current assignees — one granular add/remove per delta.
function apply() {
  const selectedUrns = new Set(selected.value.map(o => o.value))
  const currentUrns = new Set(props.assignees.map(a => a.residentUrn))
  for (const urn of selectedUrns) {
    if (!currentUrns.has(urn)) emit('add-assignee', urn)
  }
  for (const urn of currentUrns) {
    if (!selectedUrns.has(urn)) emit('remove-assignee', urn)
  }
  open.value = false
}

function initialsFor(name: string | null): string {
  const trimmed = name?.trim()
  if (!trimmed) return '?'
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('')
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <span
      v-if="!assignees.length"
      class="text-[13px] text-muted"
    >Unassigned</span>
    <span
      v-for="assignee in assignees"
      :key="assignee.residentUrn"
      class="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-1 pr-0.5"
    >
      <span class="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary/20 text-[9px] font-semibold text-primary">
        {{ initialsFor(assignee.displayName) }}
      </span>
      <span class="text-[12px] text-highlighted">{{ assignee.displayName ?? 'Unknown' }}</span>
      <UButton
        icon="i-lucide-x"
        size="xs"
        color="neutral"
        variant="ghost"
        :aria-label="`Remove ${assignee.displayName ?? 'assignee'}`"
        @click="emit('remove-assignee', assignee.residentUrn)"
      />
    </span>
    <UPopover v-model:open="open">
      <UButton
        icon="i-lucide-plus"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Edit assignees"
      />
      <template #content>
        <div class="flex flex-col gap-2 p-3">
          <USelectMenu
            v-model="selected"
            :items="residentOptions"
            multiple
            placeholder="Assign residents…"
            size="sm"
            class="w-56"
          />
          <UButton
            size="sm"
            block
            @click="apply"
          >
            Apply
          </UButton>
        </div>
      </template>
    </UPopover>
  </div>
</template>
