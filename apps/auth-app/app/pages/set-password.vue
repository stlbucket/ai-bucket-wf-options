<script setup lang="ts">
// Set-password ceremony page (user-invitation spec, set-password.ui.md). Unauthenticated landing
// target of email #2 (?userId&code). Double-entry password form → sets the password in ZITADEL →
// redirects to the login page. No useAuth() / no session created — the invitee signs in normally.
import { useColorMode } from '#imports'

const route = useRoute()
const authAppUrl = useRuntimeConfig().public.authAppUrl as string
const toast = useToast()

const colorMode = useColorMode()
const logoSrc = computed(() => (colorMode.value === 'dark' ? '/logo-dark.png' : '/logo-light.png'))

const userId = (route.query.userId as string | undefined)?.trim()
const code = (route.query.code as string | undefined)?.trim()

const state = ref<'form' | 'invalid' | 'expired'>(userId && code ? 'form' : 'invalid')
const form = reactive({ password: '', confirm: '' })
const submitting = ref(false)

// Client-side pre-filter; ZITADEL is the authority (a policy rejection surfaces verbatim as 422).
// Mirrors first-run-setup's known floor: >= 8 chars, one number, one symbol.
const longEnough = computed(() => form.password.length >= 8)
const hasNumber = computed(() => /\d/.test(form.password))
const hasSymbol = computed(() => /[^A-Za-z0-9]/.test(form.password))
const passwordValid = computed(() => longEnough.value && hasNumber.value && hasSymbol.value)
const passwordsMatch = computed(() => form.password === form.confirm)
const canSubmit = computed(() => passwordValid.value && passwordsMatch.value)

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    await $fetch(`${authAppUrl}/api/onboard/set-password`, {
      method: 'POST',
      body: { userId, code, password: form.password },
    })
    await navigateTo('/login?welcome=1')
  } catch (err) {
    const e = err as { statusCode?: number; data?: { error?: string; message?: string } }
    if (e.statusCode === 410) state.value = 'expired'
    else
      toast.add({
        title: 'Could not set your password',
        description: e.data?.message || 'Please try again.',
        color: 'error',
      })
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-8 p-6">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="flex flex-col items-center gap-3">
          <img :src="logoSrc" alt="function-bucket" class="h-8 w-auto" >
          <h2 class="text-lg font-semibold text-center">Set your password</h2>
        </div>
      </template>

      <template v-if="state === 'form'">
        <div class="flex flex-col gap-4">
          <UFormField label="New password" required>
            <UInput v-model="form.password" type="password" icon="i-lucide-lock" class="w-full" autofocus />
            <template #help>
              <span :class="passwordValid ? 'text-success' : 'text-muted'">
                At least 8 characters, one number, and one symbol.
              </span>
            </template>
          </UFormField>

          <UFormField
            label="Confirm password"
            required
            :error="form.confirm && !passwordsMatch ? 'Passwords do not match' : undefined"
          >
            <UInput v-model="form.confirm" type="password" icon="i-lucide-lock-keyhole" class="w-full" />
          </UFormField>

          <UButton block :loading="submitting" :disabled="!canSubmit" @click="submit">
            Set password &amp; continue
          </UButton>
        </div>
      </template>

      <div v-else class="flex flex-col items-center gap-4 text-center">
        <UIcon name="i-lucide-triangle-alert" class="size-10 text-warning" />
        <UAlert
          color="warning"
          variant="soft"
          title="This link is invalid or has expired"
          description="Ask your admin to re-invite you, then use the newest email."
        />
      </div>
    </UCard>
  </div>
</template>
