<script setup lang="ts">
import type { ProfileClaims, ResidencyTreeNode } from '@function-bucket/fnb-types'
import { assumeResidency } from '~/composables/useLoginFlow'

const { goHome, isLoggedIn, refreshClaims, user } = useAuth()
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

// Landing from the ZITADEL callback (?oidc=success): the sealed session cookie is set but
// localStorage claims are not — hydrate them, then run the same post-login flow as the
// password path (residency check / selection).
const route = useRoute()
onMounted(async () => {
  // First-run gate: a virgin env (no anchor tenant) steers "sign in" to /auth/setup instead of
  // an empty ZITADEL login (first-run-setup spec).
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

  if (route.query.oidc !== 'success') return
  await refreshClaims()
  if (user.value) await onLoginSuccess(user.value)
})

async function onLoginSuccess(claims: ProfileClaims) {
  if (claims.residentId) {
    await goHome()
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
    await goHome()
  } finally {
    selecting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-8 p-6">
    <div class="text-center">
      <h1 class="text-3xl font-bold tracking-tight">Sign in</h1>
      <p class="mt-2 text-muted">Enter your credentials to continue.</p>
    </div>
    <LoginForm />
    <ResidencySelectModal
      v-model:open="modalOpen"
      :residencies="residencyOptions"
      :loading="selecting"
      @select="onSelectResidency"
    />
  </div>
</template>
