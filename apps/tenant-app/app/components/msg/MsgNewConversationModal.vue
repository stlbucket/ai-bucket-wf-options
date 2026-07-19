<script setup lang="ts">
const props = defineProps<{
  topicId?: string
  topicName?: string
  hideParticipants?: boolean
}>()

const emit = defineEmits<{
  (e: 'create', name: string, participantUrns: string[], initialMessage: string): void
}>()

const { user } = useAuth()
const { residents } = useMsgResidents()

const residentOptions = computed(() =>
  residents.value
    .filter(r => r.residentId !== user.value?.residentId)
    .map(r => ({ label: r.displayName, value: r.urn }))
)

const open = ref(false)
const form = reactive({
  selectedResidents: [] as { label: string, value: string }[],
  topicName: props.topicName,
  initialMessage: ''
})

function submit() {
  if ((!props.hideParticipants && !form.selectedResidents.length) || !form.initialMessage.trim()) return
  const participantUrns = form.selectedResidents.map(r => r.value)
  const name = form.topicName?.trim() || form.selectedResidents.map(r => r.label).join(', ')
  emit('create', name, participantUrns, form.initialMessage)
  open.value = false
  form.selectedResidents = []
  form.topicName = ''
  form.initialMessage = ''
}

function cancel() {
  open.value = false
  form.selectedResidents = []
  form.topicName = ''
  form.initialMessage = ''
}
</script>

<template>
  <slot
    name="trigger"
    :open="() => (open = true)"
  >
    <UButton
      icon="i-lucide-plus"
      size="sm"
      @click="open = true"
    >
      Begin Discussion
    </UButton>
  </slot>

  <UModal
    v-model:open="open"
    title="New Conversation"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField
          v-if="!hideParticipants"
          label="Participants"
          required
        >
          <USelectMenu
            v-model="form.selectedResidents"
            :items="residentOptions"
            multiple
            placeholder="Select participants…"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Topic name">
          <UInput
            v-model="form.topicName"
            :disabled="topicName !== undefined"
            :placeholder="
              form.selectedResidents.length
                ? form.selectedResidents.map((r) => r.label).join(', ')
                : 'Optional — defaults to participant names'
            "
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="First message"
          required
        >
          <UTextarea
            v-model="form.initialMessage"
            placeholder="Write your opening message…"
            :rows="4"
            class="w-full"
          />
        </UFormField>

        <div class="flex gap-3">
          <UButton
            :disabled="!hideParticipants && (!form.selectedResidents.length || !form.initialMessage.trim())"
            @click="submit"
          >
            Start Conversation
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
            @click="cancel"
          >
            Cancel
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
