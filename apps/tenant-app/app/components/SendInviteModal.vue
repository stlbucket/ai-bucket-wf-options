<script setup lang="ts">
// "Send invite" popup for INVITED residents (the tenant-admin user detail's Resend invitation).
// Unlike InviteUserModal the trigger button lives in the host page, so this takes v-model:open +
// props instead of owning its trigger. Two explicit actions: Send email (re-fires the invite in
// email mode — the 409 re-invite path lands a set-password mail) and Copy link (link mode — the
// workflow responds synchronously with the single-use ceremony URL, no email sent). The invite
// always targets the acting admin's own claims tenant; a super admin resends from support mode.
const props = defineProps<{
  resident: { displayName: string | null; email: string }
}>()
const open = defineModel<boolean>('open', { default: false })

const { invite } = useInviteUser()
const toast = useToast()

const sendingEmail = ref(false)
const creatingLink = ref(false)
const link = ref<string | null>(null)

watch(open, (v) => {
  if (!v) link.value = null
})

function inviteInput(mode: 'email' | 'link') {
  return {
    displayName: props.resident.displayName ?? props.resident.email,
    email: props.resident.email,
    mode,
  }
}

async function sendEmail() {
  if (sendingEmail.value || creatingLink.value) return
  sendingEmail.value = true
  try {
    await invite(inviteInput('email'))
    toast.add({
      title: 'Invitation sent',
      description: `${props.resident.email} will get an email to set up their account.`,
      color: 'success',
      icon: 'i-lucide-mail-check',
    })
    open.value = false
  } catch (err) {
    toast.add({ title: 'Could not send invitation', description: mapError(err), color: 'error' })
  } finally {
    sendingEmail.value = false
  }
}

async function copyLink() {
  if (sendingEmail.value || creatingLink.value) return
  creatingLink.value = true
  try {
    const res = await invite(inviteInput('link'))
    if (!res.link) {
      toast.add({ title: 'No link was returned', description: 'Try again, or use Send email.', color: 'error' })
      return
    }
    link.value = res.link
    try {
      await navigator.clipboard.writeText(res.link)
      toast.add({ title: 'Link copied', color: 'success', icon: 'i-lucide-link' })
    } catch {
      // clipboard denied — the readonly input below is the fallback
      toast.add({ title: 'Copy the link from the field below', color: 'warning' })
    }
  } catch (err) {
    toast.add({ title: 'Could not create invite link', description: mapError(err), color: 'error' })
  } finally {
    creatingLink.value = false
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
</script>

<template>
  <UModal
    v-model:open="open"
    title="Send invite"
    :description="`${resident.displayName ?? resident.email} has not accepted their invitation yet.`"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap gap-3">
          <UButton
            icon="i-lucide-mail"
            :loading="sendingEmail"
            :disabled="creatingLink"
            @click="sendEmail"
          >
            Send email
          </UButton>
          <UButton
            icon="i-lucide-link"
            variant="outline"
            :loading="creatingLink"
            :disabled="sendingEmail"
            @click="copyLink"
          >
            Copy link
          </UButton>
        </div>

        <div
          v-if="link"
          class="flex items-center gap-2"
        >
          <UInput
            :model-value="link"
            readonly
            icon="i-lucide-link"
            class="w-full font-mono"
          />
        </div>

        <p class="text-xs text-muted">
          The link is single-use and lets the holder set this account's password — share it
          directly with the invitee only.
        </p>
      </div>
    </template>
  </UModal>
</template>
