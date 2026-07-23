<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRuntimeConfig } from 'nuxt/app'

// Temporary-session banner (spec .claude/specs/otp-login/ _shared.data.md §8). OTP quick-login
// sessions are short-lived (sliding 1h idle / 8h cap). The sid lives in the sealed cookie, not the
// claims, so auth_method + expiry come from the auth-app pre-claims route /auth/api/session-info
// (same-origin; the httpOnly cookie rides along), NOT GraphQL. Renders only for auth_method='otp'.
const {
  public: { authAppUrl },
} = useRuntimeConfig()

interface SessionInfo {
  authMethod: 'zitadel' | 'otp'
  expiresAt: string
}

const info = ref<SessionInfo | null>(null)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

const isOtp = computed(() => info.value?.authMethod === 'otp')
const minutesLeft = computed(() => {
  if (!info.value) return 0
  const ms = new Date(info.value.expiresAt).getTime() - now.value
  return Math.max(0, Math.round(ms / 60000))
})

onMounted(async () => {
  try {
    const { session } = await $fetch<{ session: SessionInfo | null }>(
      `${authAppUrl}/api/session-info`,
    )
    info.value = session
    if (session?.authMethod === 'otp') {
      timer = setInterval(() => {
        now.value = Date.now()
      }, 30000)
    }
  } catch {
    info.value = null
  }
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <UAlert
    v-if="isOtp"
    color="info"
    variant="soft"
    icon="i-lucide-clock"
    class="rounded-none border-b border-default"
    :title="`Quick session — expires in ${minutesLeft}m`"
    description="You're in a temporary login. Sign in fully to stay longer."
  />
</template>
