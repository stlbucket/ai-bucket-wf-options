<script setup lang="ts">
// Self-service change-password form (password-self-service spec, change-password.ui.md). Lives in
// auth-layer, auto-imported by the auth-app /auth/profile page. The target is ALWAYS the logged-in
// user — identity comes from the session server-side, there is no target picker. Posts the current
// + new password to the authenticated change-password route; ZITADEL verifies the current one.
const authAppUrl = useRuntimeConfig().public.authAppUrl as string
const toast = useToast()

const form = reactive({ current: '', next: '', confirm: '' })
const submitting = ref(false)
const currentError = ref<string | undefined>(undefined)

// Client pre-filter; ZITADEL is the authority (a policy rejection surfaces verbatim as a 422 toast).
// Mirrors the set-password floor: >= 8 chars, one number, one symbol.
const longEnough = computed(() => form.next.length >= 8)
const hasNumber = computed(() => /\d/.test(form.next))
const hasSymbol = computed(() => /[^A-Za-z0-9]/.test(form.next))
const nextValid = computed(() => longEnough.value && hasNumber.value && hasSymbol.value)
const matches = computed(() => form.next === form.confirm)
const distinct = computed(() => !form.next || form.next !== form.current)
const canSubmit = computed(
  () => !!form.current && nextValid.value && matches.value && form.next !== form.current,
)

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  currentError.value = undefined
  try {
    await $fetch(`${authAppUrl}/api/profile/change-password`, {
      method: 'POST',
      body: { current: form.current, next: form.next },
    })
    toast.add({ title: 'Password updated', color: 'success' })
    form.current = ''
    form.next = ''
    form.confirm = ''
  } catch (err) {
    const e = err as { statusCode?: number; data?: { error?: string; message?: string } }
    if (e.statusCode === 401 && e.data?.error === 'wrong-current') {
      currentError.value = 'Current password is incorrect'
    } else if (e.statusCode === 409) {
      toast.add({
        title: "Password change isn't available for this account yet",
        color: 'error',
      })
    } else if (e.statusCode === 422) {
      toast.add({
        title: 'Could not update password',
        description: e.data?.message || 'Please choose a stronger password.',
        color: 'error',
      })
    } else {
      toast.add({ title: 'Could not update password', description: 'Please try again.', color: 'error' })
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UCard class="w-full">
    <template #header>
      <h2 class="text-lg font-semibold">Change password</h2>
    </template>

    <div class="flex flex-col gap-4">
      <UFormField label="Current password" required :error="currentError">
        <UInput
          v-model="form.current"
          type="password"
          icon="i-lucide-lock"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <UFormField label="New password" required>
        <UInput
          v-model="form.next"
          type="password"
          icon="i-lucide-lock-keyhole"
          autocomplete="new-password"
          class="w-full"
        />
        <template #help>
          <span :class="nextValid ? 'text-success' : 'text-muted'">
            At least 8 characters, one number, and one symbol.
          </span>
        </template>
      </UFormField>

      <UFormField
        label="Confirm new password"
        required
        :error="
          form.confirm && !matches
            ? 'Passwords do not match'
            : form.next && !distinct
              ? 'New password must be different from the current one'
              : undefined
        "
      >
        <UInput
          v-model="form.confirm"
          type="password"
          icon="i-lucide-lock-keyhole"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UButton block :loading="submitting" :disabled="!canSubmit" @click="submit">
        Update password
      </UButton>
    </div>
  </UCard>
</template>
