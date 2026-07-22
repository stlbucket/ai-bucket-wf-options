<script setup lang="ts">
// Verify-email ceremony page (user-invitation spec, verify-email.ui.md). Unauthenticated landing
// target of email #1 (?userId&code). Auto-verifies on load (U3), then offers a button to send the
// set-password link (email #2). No useAuth() — the invitee has no session yet.
import { useColorMode } from '#imports'

const route = useRoute()
const authAppUrl = useRuntimeConfig().public.authAppUrl as string
const toast = useToast()

const colorMode = useColorMode()
const logoSrc = computed(() => (colorMode.value === 'dark' ? '/logo-dark.png' : '/logo-light.png'))

const userId = (route.query.userId as string | undefined)?.trim()
const code = (route.query.code as string | undefined)?.trim()

type State = 'verifying' | 'verified' | 'sendingLink' | 'linkSent' | 'expired' | 'invalid'
const state = ref<State>('verifying')

onMounted(async () => {
  if (!userId || !code) {
    state.value = 'invalid'
    return
  }
  try {
    await $fetch(`${authAppUrl}/api/onboard/verify-email`, { method: 'POST', body: { userId, code } })
    state.value = 'verified'
  } catch (err) {
    state.value = (err as { statusCode?: number }).statusCode === 410 ? 'expired' : 'invalid'
  }
})

async function requestLink() {
  state.value = 'sendingLink'
  try {
    await $fetch(`${authAppUrl}/api/onboard/request-password`, { method: 'POST', body: { userId } })
    state.value = 'linkSent'
  } catch {
    state.value = 'verified'
    toast.add({ title: 'Could not send the link', description: 'Please try again in a moment.', color: 'error' })
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-8 p-6">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="flex flex-col items-center gap-3">
          <img :src="logoSrc" alt="function-bucket" class="h-8 w-auto" >
          <h2 class="text-lg font-semibold text-center">Welcome to function-bucket</h2>
        </div>
      </template>

      <div class="flex flex-col items-center gap-4 text-center">
        <template v-if="state === 'verifying'">
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
          <p class="text-muted">Verifying your email…</p>
        </template>

        <template v-else-if="state === 'verified' || state === 'sendingLink'">
          <UIcon name="i-lucide-badge-check" class="size-10 text-success" />
          <div>
            <p class="font-medium">Email verified</p>
            <p class="mt-1 text-sm text-muted">One more step — set your password to finish setting up your account.</p>
          </div>
          <UButton block :loading="state === 'sendingLink'" icon="i-lucide-mail" @click="requestLink">
            Send me a link to set my password
          </UButton>
        </template>

        <template v-else-if="state === 'linkSent'">
          <UIcon name="i-lucide-mail-check" class="size-10 text-success" />
          <UAlert
            color="success"
            variant="soft"
            title="Check your email"
            description="We sent a link to set your password to your inbox."
          />
        </template>

        <template v-else>
          <UIcon name="i-lucide-triangle-alert" class="size-10 text-warning" />
          <UAlert
            color="warning"
            variant="soft"
            title="This link is invalid or has expired"
            description="Ask your admin to re-invite you, then use the newest email."
          />
        </template>
      </div>
    </UCard>
  </div>
</template>
