<script setup lang="ts">
import { computed } from 'vue'
import { useColorMode } from '#imports'
import { useAuth } from '@function-bucket/fnb-auth-ui'

// ZITADEL owns the login ceremony (zitadel-login-pattern.md, stage-5 cutover): this is a
// full-page redirect into the hosted login. The callback sets the sealed session cookie and
// lands on /login?oidc=success, where the page hydrates claims and runs the residency flow.
const { loginWithRedirect } = useAuth()

// Optional root-relative path the ceremony returns to after the residency flow, instead of home
// (auth-app/login.data.md §Return-to). The deep-link landing page passes `/auth/go/<id>`; the
// bare login page omits it → home.
const props = defineProps<{ returnTo?: string }>()

// Brand wordmark (plan 0500) — assets live in auth-layer/public. Swap per color mode:
// logo-dark on dark surfaces (transparent), logo-light on light.
const colorMode = useColorMode()
const logoSrc = computed(() =>
  colorMode.value === 'dark' ? '/logo-dark.png' : '/logo-light.png',
)
</script>

<template>
  <UCard class="w-full max-w-sm">
    <template #header>
      <div class="flex flex-col items-center gap-3">
        <img :src="logoSrc" alt="function-bucket" class="h-8 w-auto" />
        <h2 class="text-lg font-semibold text-center">Sign in to your account</h2>
      </div>
    </template>

    <UButton icon="i-lucide-log-in" block @click="loginWithRedirect(props.returnTo)">
      Sign in with ZITADEL
    </UButton>
  </UCard>
</template>
