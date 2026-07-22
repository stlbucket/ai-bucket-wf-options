<script setup lang="ts">
// First-run setup (spec: .claude/specs/first-run-setup/setup.ui.md). On a VIRGIN env (no anchor
// tenant) the first visitor names the first tenant + site admin here; a provisioned env never
// shows this page (mount gate redirects to /login). Submitting mints the anchor tenant + admin
// profile (db-access raw pg) AND the matching ZITADEL user, then auto-redirects into OIDC login.
import { useColorMode } from '#imports'
import { useAuth } from '@function-bucket/fnb-auth-ui'

const { loginWithRedirect } = useAuth()
const toast = useToast()
const authAppUrl = useRuntimeConfig().public.authAppUrl as string

const colorMode = useColorMode()
const logoSrc = computed(() => (colorMode.value === 'dark' ? '/logo-dark.png' : '/logo-light.png'))

const form = reactive({
  tenantName: '',
  email: '',
  displayName: '',
  firstName: '',
  lastName: '',
  phone: '',
  password: '',
  confirmPassword: '',
  setupToken: '',
})
const submitting = ref(false)
const errorMessage = ref<string | null>(null)
const showSignIn = ref(false)

// Client-side complexity pre-filter (ZITADEL stays the source of truth — a server-side rejection
// is surfaced verbatim as 422). Decision 2026-07-21: min 8 chars, >= 1 number, >= 1 symbol.
const passwordLongEnough = computed(() => form.password.length >= 8)
const passwordHasNumber = computed(() => /\d/.test(form.password))
const passwordHasSymbol = computed(() => /[^A-Za-z0-9]/.test(form.password))
const passwordValid = computed(
  () => passwordLongEnough.value && passwordHasNumber.value && passwordHasSymbol.value,
)
const passwordsMatch = computed(() => form.password === form.confirmPassword)
const emailValid = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))

const canSubmit = computed(
  () =>
    !!form.tenantName.trim() &&
    emailValid.value &&
    passwordValid.value &&
    passwordsMatch.value &&
    !!form.setupToken.trim(),
)

// Mount gate: a provisioned env (needsSetup === false) never shows setup.
onMounted(async () => {
  try {
    const { needsSetup } = await $fetch<{ needsSetup: boolean }>(
      `${authAppUrl}/api/setup/status`,
    )
    if (!needsSetup) await navigateTo('/login', { replace: true })
  } catch {
    // status unreachable — leave the form up; submit still enforces every gate server-side.
  }
})

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  errorMessage.value = null
  showSignIn.value = false
  try {
    await $fetch(`${authAppUrl}/api/setup/initialize`, {
      method: 'POST',
      body: {
        tenantName: form.tenantName,
        email: form.email,
        password: form.password,
        setupToken: form.setupToken,
        displayName: form.displayName || undefined,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
      },
    })
    // Success: the ZITADEL user + anchor tenant/profile exist and residency is active.
    // Auto-redirect straight into the OIDC ceremony (decision 2026-07-21).
    toast.add({ title: 'Site created — signing you in…', color: 'success' })
    await loginWithRedirect()
  } catch (err) {
    const data = (err as { data?: { error?: string; message?: string } }).data
    switch (data?.error) {
      case 'INVALID_SETUP_TOKEN':
        errorMessage.value = 'Invalid setup token.'
        form.setupToken = ''
        break
      case 'SETUP_NOT_CONFIGURED':
        errorMessage.value = 'Setup is not configured on the server (SETUP_TOKEN missing).'
        break
      case 'SETUP_ALREADY_COMPLETE':
        errorMessage.value = 'This site is already set up.'
        showSignIn.value = true
        break
      case 'ZITADEL_REJECTED':
        errorMessage.value = data?.message || 'The identity service rejected the password.'
        break
      case 'ZITADEL_UNAVAILABLE':
        errorMessage.value = 'The identity service is unavailable. Please try again.'
        break
      case 'INVALID_INPUT':
        errorMessage.value = 'Please fill in all required fields.'
        break
      default:
        errorMessage.value = 'Something went wrong. Please try again.'
    }
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-8 p-6">
    <UCard class="w-full max-w-lg">
      <template #header>
        <div class="flex flex-col items-center gap-3">
          <img :src="logoSrc" alt="function-bucket" class="h-8 w-auto" >
          <h2 class="text-lg font-semibold text-center">Set up function-bucket</h2>
          <p class="text-sm text-muted text-center">Create the first tenant and site admin.</p>
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <UFormField label="Tenant name" required>
          <UInput v-model="form.tenantName" placeholder="Your organization" class="w-full" autofocus />
        </UFormField>

        <UFormField label="Email" required>
          <UInput v-model="form.email" type="email" placeholder="admin@example.com" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="First name">
            <UInput v-model="form.firstName" class="w-full" />
          </UFormField>
          <UFormField label="Last name">
            <UInput v-model="form.lastName" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Display name">
          <UInput v-model="form.displayName" placeholder="Defaults to the email name" class="w-full" />
        </UFormField>

        <UFormField label="Phone">
          <UInput v-model="form.phone" class="w-full" />
        </UFormField>

        <USeparator />

        <UFormField label="Password" required>
          <UInput v-model="form.password" type="password" class="w-full" />
          <template #help>
            <span :class="passwordValid ? 'text-success' : 'text-muted'">
              At least 8 characters, one number, and one symbol.
            </span>
          </template>
        </UFormField>

        <UFormField
          label="Confirm password"
          required
          :error="form.confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined"
        >
          <UInput v-model="form.confirmPassword" type="password" class="w-full" />
        </UFormField>

        <UFormField label="Setup token" required help="The SETUP_TOKEN configured for this deployment.">
          <UInput v-model="form.setupToken" type="password" class="w-full" />
        </UFormField>

        <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage">
          <template v-if="showSignIn" #description>
            <ULink to="/login">Go to sign in</ULink>
          </template>
        </UAlert>

        <UButton :loading="submitting" :disabled="!canSubmit" block @click="submit">
          Create site &amp; continue
        </UButton>
      </div>
    </UCard>
  </div>
</template>
