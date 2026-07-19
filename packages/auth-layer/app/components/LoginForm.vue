<script setup lang="ts">
import { useAuth } from '@function-bucket/fnb-auth-ui'

// ZITADEL owns the login ceremony (zitadel-login-pattern.md, stage-5 cutover): this is a
// full-page redirect into the hosted login. The callback sets the sealed session cookie and
// lands on /login?oidc=success, where the page hydrates claims and runs the residency flow.
const { loginWithRedirect } = useAuth()
</script>

<template>
  <UCard class="w-full max-w-sm">
    <template #header>
      <h2 class="text-lg font-semibold text-center">Sign in to your account</h2>
    </template>

    <UButton icon="i-lucide-log-in" block @click="loginWithRedirect()">
      Sign in with ZITADEL
    </UButton>
  </UCard>
</template>
