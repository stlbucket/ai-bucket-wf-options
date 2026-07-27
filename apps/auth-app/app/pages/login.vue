<script setup lang="ts">
import type { ProfileClaims, ResidencyTreeNode } from '@function-bucket/fnb-types'
import { isSafeReturnTo } from '@function-bucket/fnb-types'
import { assumeResidency } from '~/composables/useLoginFlow'

const { goHome, isLoggedIn, loginWithRedirect, refreshClaims, user } = useAuth()
const authAppUrl = useRuntimeConfig().public.authAppUrl as string
const { $urqlClient } = useNuxtApp() as unknown as {
  $urqlClient: Parameters<typeof assumeResidency>[0]
}

if (isLoggedIn.value) {
  await goHome()
}

const residencyOptions = ref<ResidencyTreeNode[]>([])
const modalOpen = ref(false)
const selecting = ref(false)

// Auto-redirect dispatcher (zitadel-login-pattern.md §Extension): the fnb-branded ZITADEL
// hosted login is the single landing page — this page only dispatches, except on the
// ?oidc=success return leg and the ?welcome=1 pause.
const route = useRoute()

// True on the paths that immediately leave for ZITADEL — drives the subheading; LoginForm
// stays rendered underneath as the manual fallback if the redirect is blocked.
const redirecting = computed(
  () => route.query.oidc !== 'success' && route.query.welcome !== '1',
)

onMounted(async () => {
  // First-run gate: a virgin env (no anchor tenant) steers "sign in" to /auth/setup instead of
  // an empty ZITADEL login (first-run-setup spec). Must stay ahead of the auto-redirect.
  try {
    const { needsSetup } = await $fetch<{ needsSetup: boolean }>(
      `${authAppUrl}/api/setup/status`,
    )
    if (needsSetup) {
      await navigateTo('/setup', { replace: true })
      return
    }
  } catch {
    // status unreachable — fall through to the normal login page
  }

  // Return leg from the ZITADEL callback: the sealed session cookie is set but localStorage
  // claims are not — hydrate them, then run the residency flow. Never auto-redirect here.
  if (route.query.oidc === 'success') {
    await refreshClaims()
    if (user.value) await onLoginSuccess(user.value)
    return
  }

  // ?welcome=1 pause (invitation set-password ceremony): keep the confirmation readable —
  // the explicit button below continues into ZITADEL.
  if (route.query.welcome === '1') return

  // Single landing page: start the ceremony immediately, threading a valid deep-link
  // returnTo through the round-trip (login.data.md §Return-to; fail-closed).
  const returnTo = route.query.returnTo
  await loginWithRedirect(isSafeReturnTo(returnTo) ? returnTo : undefined)
})

// End the ceremony at the requested return-to (auth-app/login.data.md §Return-to) when a valid one
// rode the round-trip — the deep-link "Sign in with ZITADEL" case — otherwise home. Validated
// fail-closed; a tampered/foreign value falls back to goHome().
async function finishLogin() {
  const returnTo = route.query.returnTo
  if (isSafeReturnTo(returnTo)) {
    await navigateTo(returnTo, { external: true })
    return
  }
  await goHome()
}

async function onLoginSuccess(claims: ProfileClaims) {
  if (claims.residentId) {
    await finishLogin()
    return
  }

  // Residencies ride the claims we just refreshed (ProfileClaims.residencies — the workspace-
  // switcher delivery); ghost ancestor nodes carry no residentId and can't be selected.
  const residencies = (claims.residencies ?? []).filter((r) => r.residentId !== null)

  if (residencies.length === 1 && residencies[0].residentId) {
    await onSelectResidency(residencies[0].residentId)
    return
  }

  residencyOptions.value = residencies
  modalOpen.value = true
}

async function onSelectResidency(residentId: string) {
  selecting.value = true
  try {
    await assumeResidency($urqlClient, residentId)
    await refreshClaims()
    await finishLogin()
  } finally {
    selecting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-8 p-6">
    <div class="text-center">
      <h1 class="text-3xl font-bold tracking-tight">Sign in</h1>
      <p class="mt-2 text-muted">
        {{ redirecting ? 'Redirecting to sign-in…' : 'Enter your credentials to continue.' }}
      </p>
    </div>
    <!-- One-time notice after the invitation set-password ceremony (user-invitation spec). -->
    <UAlert
      v-if="route.query.welcome === '1'"
      class="max-w-sm"
      color="success"
      variant="soft"
      icon="i-lucide-circle-check"
      title="Password set"
      description="Sign in with your email and the password you just chose."
    />
    <LoginForm />
    <ResidencySelectModal
      v-model:open="modalOpen"
      :residencies="residencyOptions"
      :loading="selecting"
      @select="onSelectResidency"
    />
  </div>
</template>
