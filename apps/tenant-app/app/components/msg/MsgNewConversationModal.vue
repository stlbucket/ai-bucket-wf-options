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

// A message topic is tenant-scoped (subscribers must be residents of the topic's tenant), but
// residentsList is not: under super-admin/child-workspace RLS it returns residents from every
// tenant, so the same person shows up once per tenant they hold a residency in. Scope the picker
// to the caller's own tenant — within one tenant there is exactly one residency per person.
const tenantResidents = computed(() =>
  residents.value.filter(r => !user.value?.tenantId || r.tenantId === user.value.tenantId)
)

// Exclude the current user by profileId, not residentId — the claims residentId can lag the
// server-side session (residency switch / support mode), while profileId is stable.
function isCurrentUser(r: { residentId: string, profileId: string | null }) {
  return (
    r.residentId === user.value?.residentId
    || (r.profileId != null && r.profileId === user.value?.profileId)
  )
}

const residentOptions = computed(() =>
  tenantResidents.value
    .filter(r => !isCurrentUser(r))
    .map(r => ({ label: r.displayName, value: r.urn }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
)

const currentUserUrn = computed(() => {
  const mine = tenantResidents.value.filter(isCurrentUser)
  return (mine.find(r => r.residentId === user.value?.residentId) ?? mine[0])?.urn
})

const open = ref(false)
const form = reactive({
  selectedResidents: [] as { label: string, value: string }[],
  topicName: props.topicName ?? '',
  initialMessage: ''
})

function submit() {
  const name = form.topicName.trim()
  if (!name || (!props.hideParticipants && !form.selectedResidents.length) || !form.initialMessage.trim()) return
  const participantUrns = form.selectedResidents.map(r => r.value)
  if (currentUserUrn.value && !participantUrns.includes(currentUserUrn.value)) {
    participantUrns.push(currentUserUrn.value)
  }
  emit('create', name, participantUrns, form.initialMessage)
  open.value = false
  resetForm()
}

function cancel() {
  open.value = false
  resetForm()
}

function resetForm() {
  form.selectedResidents = []
  form.topicName = props.topicName ?? ''
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

        <UFormField
          label="Topic name"
          required
        >
          <UInput
            v-model="form.topicName"
            :disabled="topicName !== undefined"
            placeholder="Enter topic name…"
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
            :disabled="!form.topicName.trim() || (!hideParticipants && !form.selectedResidents.length) || !form.initialMessage.trim()"
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
