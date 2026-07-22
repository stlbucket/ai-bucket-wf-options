<script setup lang="ts">
// Admin "Invite User" action (user-invitation spec, admin-invite.ui.md). Self-contained trigger +
// modal: on submit it dispatches the invite-user workflow (useInviteUser → triggerWorkflow, gated
// p:app-admin at the plugin), toasts, and closes. Fire-and-forget — the resident lands `invited`
// async, so the residents list is NOT refetched here (a refresh/next nav shows it).
const { invite, fetching } = useInviteUser()
const toast = useToast()

const open = ref(false)
const form = reactive({ displayName: '', email: '' })

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
const canSubmit = computed(() => form.displayName.trim().length > 0 && emailValid.value)

async function submit() {
  if (!canSubmit.value || fetching.value) return
  const email = form.email.trim()
  try {
    await invite({ displayName: form.displayName.trim(), email })
    toast.add({
      title: 'Invitation sent',
      description: `${email} will get an email to set up their account.`,
      color: 'success',
      icon: 'i-lucide-mail-check',
    })
    reset()
  } catch (err) {
    // keep the modal open so the admin can retry
    toast.add({ title: 'Could not send invitation', description: mapError(err), color: 'error' })
  }
}

function mapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/not authenticated|\b401\b/i.test(msg)) return 'Your session has expired — please sign in again.'
  if (/not authorized|\b30000\b|p:app-admin/i.test(msg)) return 'You do not have permission to invite users.'
  return msg || 'Something went wrong. Please try again.'
}

function reset() {
  open.value = false
  form.displayName = ''
  form.email = ''
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
  >
    <template #body>
      <div class="flex flex-col gap-4">
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

        <div class="flex gap-3">
          <UButton
            :disabled="!canSubmit"
            :loading="fetching"
            @click="submit"
          >
            Send invitation
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
