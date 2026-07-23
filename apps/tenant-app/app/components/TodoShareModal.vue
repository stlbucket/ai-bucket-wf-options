<script setup lang="ts">
// D14 "Send to residents" (OTP-login spec, share-link.ui.md). Self-contained action modal (mirrors
// InviteUserModal): pick residents of this workspace, add a message, choose Email/SMS, and send the
// TENANT-SCOPED quick-login link. Delivery is fire-and-forget via the send-deep-link n8n workflow
// (useDeepLink.sendDeepLink → triggerWorkflow); recipients still self-identify with a one-time code
// on the landing page (the link is a pointer, not a bearer token).
interface ResidentOption {
  residentId: string
  displayName: string
}
const props = defineProps<{
  subjectUrn: string
  subjectLabel: string
  residents: ResidentOption[]
}>()

const { sendDeepLink } = useDeepLink()
const { user } = useAuth()
const toast = useToast()
const authAppUrl = useRuntimeConfig().public.authAppUrl as string

const open = ref(false)
const selected = reactive<Record<string, boolean>>({})
const message = ref('')
const channels = reactive({ email: true, sms: false })
const sending = ref(false)

const selectedIds = computed(() => Object.keys(selected).filter((id) => selected[id]))
const canSend = computed(
  () => selectedIds.value.length > 0 && (channels.email || channels.sms),
)

async function submit() {
  if (!canSend.value || sending.value) return
  sending.value = true
  try {
    const chosen: ('email' | 'sms')[] = [
      ...(channels.email ? (['email'] as const) : []),
      ...(channels.sms ? (['sms'] as const) : []),
    ]
    const { count } = await sendDeepLink({
      subjectUrn: props.subjectUrn,
      subjectLabel: props.subjectLabel,
      residentIds: selectedIds.value,
      message: message.value,
      channels: chosen,
      senderName: user.value?.displayName ?? null,
      authAppUrl,
    })
    toast.add({
      title: `Sending to ${count} resident${count === 1 ? '' : 's'}…`,
      description: 'They can open the link and log in with a one-time code.',
      color: 'success',
      icon: 'i-lucide-send',
    })
    reset()
  } catch {
    toast.add({ title: 'Could not send', color: 'error' })
  } finally {
    sending.value = false
  }
}

function reset() {
  open.value = false
  for (const id of Object.keys(selected)) selected[id] = false
  message.value = ''
  channels.email = true
  channels.sms = false
}
</script>

<template>
  <UButton
    icon="i-lucide-send"
    variant="outline"
    size="sm"
    @click="open = true"
  >
    Send to residents
  </UButton>

  <UModal
    v-model:open="open"
    title="Send quick-login link"
    :description="`Share “${subjectLabel}” with residents of this workspace. They log in with a one-time code — no account setup needed.`"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField
          label="Residents"
          required
        >
          <div
            v-if="residents.length"
            class="flex flex-col gap-2"
          >
            <UCheckbox
              v-for="r in residents"
              :key="r.residentId"
              v-model="selected[r.residentId]"
              :label="r.displayName || 'Unnamed'"
            />
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            No residents in this workspace.
          </p>
        </UFormField>

        <UFormField label="Message (optional)">
          <UTextarea
            v-model="message"
            :rows="3"
            placeholder="Add a note…"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Delivery">
          <div class="flex gap-4">
            <UCheckbox
              v-model="channels.email"
              label="Email"
            />
            <UCheckbox
              v-model="channels.sms"
              label="SMS"
            />
          </div>
        </UFormField>

        <div class="flex gap-3">
          <UButton
            :disabled="!canSend"
            :loading="sending"
            @click="submit"
          >
            Send
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
            @click="reset"
          >
            Cancel
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
