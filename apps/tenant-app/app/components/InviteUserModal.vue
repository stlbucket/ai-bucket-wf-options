<script setup lang="ts">
// Admin "Invite User" action (user-invitation spec, admin-invite.ui.md). Self-contained trigger +
// modal: on submit it dispatches the invite-user workflow (useInviteUser → triggerWorkflow, gated
// p:app-admin at the plugin; the invite always lands in the acting admin's own claims tenant —
// super admins enter support mode to invite elsewhere). The "Send invite immediately" checkbox
// (U9) picks the mode: checked → email #1 lands in the invitee's inbox; unchecked → link mode,
// the single-use ceremony URL is shown in-modal instead. The checkbox default is the value used
// on the previous successful invite (localStorage, written on success only — not on toggle).
const emit = defineEmits<{ invited: [] }>()

const { invite, fetching } = useInviteUser()
const toast = useToast()

const SEND_IMMEDIATELY_KEY = 'invite-user-send-immediately'

const open = ref(false)
const form = reactive({ displayName: '', email: '' })
const sendImmediately = ref(true)
const inviteLink = ref<string | null>(null)

onMounted(() => {
  const saved = localStorage.getItem(SEND_IMMEDIATELY_KEY)
  if (saved !== null) sendImmediately.value = saved !== 'false'
})

// Domain labels must be dot-separated non-empty runs — catches consecutive dots
// (user@example..com), which ZITADEL rejects with a 400 deep in the workflow.
const emailValid = computed(() => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(form.email.trim()))
const canSubmit = computed(() => form.displayName.trim().length > 0 && emailValid.value)

async function submit() {
  if (!canSubmit.value || fetching.value) return
  const email = form.email.trim()
  try {
    const res = await invite({
      displayName: form.displayName.trim(),
      email,
      mode: sendImmediately.value ? 'email' : 'link',
    })
    localStorage.setItem(SEND_IMMEDIATELY_KEY, String(sendImmediately.value))
    if (sendImmediately.value) {
      toast.add({
        title: 'Invitation sent',
        description: `${email} will get an email to set up their account.`,
        color: 'success',
        icon: 'i-lucide-mail-check',
      })
      reset()
    } else if (res.link) {
      inviteLink.value = res.link
      toast.add({
        title: 'Invite created — link ready',
        description: 'No email was sent. Share the link directly with the invitee.',
        color: 'success',
        icon: 'i-lucide-link',
      })
    } else {
      // The invite landed but the workflow returned no link (stale engine / unexpected body).
      toast.add({
        title: 'Invite created, but no link was returned',
        description: 'Use the Send invite action on the user row to retry.',
        color: 'warning',
      })
      reset()
    }
    emit('invited')
  } catch (err) {
    // keep the modal open so the admin can retry
    toast.add({ title: 'Could not send invitation', description: mapError(err), color: 'error' })
  }
}

async function copyLink() {
  if (!inviteLink.value) return
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    toast.add({ title: 'Link copied', color: 'success', icon: 'i-lucide-copy' })
  } catch {
    // clipboard denied — the readonly input below is the fallback
    toast.add({ title: 'Copy the link from the field below', color: 'warning' })
  }
}

function mapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/not authenticated|\b401\b/i.test(msg)) return 'Your session has expired — please sign in again.'
  if (/not authorized|\b30000\b|p:app-admin/i.test(msg)) return 'You do not have permission to invite users.'
  // The workflow rejected the invite (surfaced as a webhook 5xx) — bad email is the usual cause.
  if (/workflow trigger failed/i.test(msg)) return 'The invite could not be processed — double-check the email address and try again.'
  return msg || 'Something went wrong. Please try again.'
}

function reset() {
  open.value = false
  form.displayName = ''
  form.email = ''
  inviteLink.value = null
}
</script>

<template>
  <UButton
    icon="i-lucide-user-plus"
    size="sm"
    @click="open = true"
  >
    Invite User
  </UButton>

  <UModal
    v-model:open="open"
    title="Invite User"
    description="Creates the resident and emails them a link to verify their address and set a password."
    @update:open="(v: boolean) => { if (!v) reset() }"
  >
    <template #body>
      <div
        v-if="!inviteLink"
        class="flex flex-col gap-4"
      >
        <UFormField
          label="Display name"
          required
        >
          <UInput
            v-model="form.displayName"
            icon="i-lucide-user"
            placeholder="e.g. Ada Lovelace"
            class="w-full"
            @keyup.enter="submit"
          />
        </UFormField>

        <UFormField
          label="Email"
          required
          :error="form.email.trim() && !emailValid ? 'Enter a valid email address' : undefined"
        >
          <UInput
            v-model="form.email"
            type="email"
            icon="i-lucide-mail"
            placeholder="name@example.com"
            class="w-full"
            @keyup.enter="submit"
          />
        </UFormField>

        <UCheckbox
          v-model="sendImmediately"
          label="Send invite immediately"
          :disabled="fetching"
        />

        <div class="flex gap-3">
          <UButton
            :disabled="!canSubmit"
            :loading="fetching"
            @click="submit"
          >
            Save
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

      <div
        v-else
        class="flex flex-col gap-4"
      >
        <div class="flex items-center gap-2">
          <UInput
            :model-value="inviteLink"
            readonly
            icon="i-lucide-link"
            class="w-full font-mono"
          />
          <UButton
            icon="i-lucide-copy"
            variant="outline"
            color="neutral"
            aria-label="Copy invite link"
            @click="copyLink"
          />
        </div>
        <p class="text-xs text-muted">
          The link is single-use and lets the holder set this account's password — share it
          directly with the invitee only.
        </p>
        <div class="flex gap-3">
          <UButton @click="reset">
            Done
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
