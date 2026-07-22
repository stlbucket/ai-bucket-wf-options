<script setup lang="ts">
// Forgot-password page (password-self-service spec, forgot-password.ui.md). Unauthenticated entry
// linked from the home-page hero. Submitting an email fires the n8n forgot-password workflow and
// ALWAYS shows the same generic "if an account exists…" message (no account enumeration) — the UI
// never branches on whether ZITADEL had the user. On success the user lands here -> email ->
// the existing /auth/set-password page (unchanged).
import { useColorMode } from '#imports'

const authAppUrl = useRuntimeConfig().public.authAppUrl as string
const toast = useToast()

const colorMode = useColorMode()
const logoSrc = computed(() => (colorMode.value === 'dark' ? '/logo-dark.png' : '/logo-light.png'))

const form = reactive({ email: '' })
const submitting = ref(false)
const state = ref<'form' | 'sent'>('form')

// Format only — existence is never checked client-side.
const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))

async function submit() {
  if (!emailValid.value || submitting.value) return
  submitting.value = true
  try {
    await $fetch(`${authAppUrl}/api/forgot-password`, {
      method: 'POST',
      body: { email: form.email.trim() },
    })
    // Same generic outcome whether or not an account exists.
    state.value = 'sent'
  } catch {
    toast.add({
      title: 'Something went wrong',
      description: 'Please try again.',
      color: 'error',
    })
  } finally {
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
          <h2 class="text-lg font-semibold text-center">Reset your password</h2>
        </div>
      </template>

      <template v-if="state === 'form'">
        <div class="flex flex-col gap-4">
          <p class="text-sm text-muted text-center">
            Enter your email and we'll send you a link to set a new password.
          </p>
          <UFormField label="Email" required>
            <UInput
              v-model="form.email"
              type="email"
              icon="i-lucide-mail"
              autocomplete="email"
              class="w-full"
              autofocus
              @keyup.enter="submit"
            />
          </UFormField>
          <UButton block :loading="submitting" :disabled="!emailValid" @click="submit">
            Send reset link
          </UButton>
          <div class="text-center">
            <ULink :href="`${authAppUrl}/login`" :external="true" class="text-sm text-muted">
              Back to sign in
            </ULink>
          </div>
        </div>
      </template>

      <div v-else class="flex flex-col items-center gap-4 text-center">
        <UIcon name="i-lucide-mail-check" class="size-10 text-primary" />
        <p class="text-sm">
          If an account exists for <b>{{ form.email.trim() }}</b>, we've sent a link to set a new
          password.
        </p>
        <p class="text-sm text-muted">
          Check your inbox (and spam). The link expires — request a new one if needed.
        </p>
        <ULink :href="`${authAppUrl}/login`" :external="true" class="text-sm text-primary">
          Back to sign in
        </ULink>
      </div>
    </UCard>
  </div>
</template>
