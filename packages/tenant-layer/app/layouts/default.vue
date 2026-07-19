<script setup lang="ts">
import { useRuntimeConfig } from 'nuxt/app'
import { useAuth } from '@function-bucket/fnb-auth-layer/app/composables/useAuth'

const { isLoggedIn } = useAuth()
const { public: { authAppUrl } } = useRuntimeConfig()
</script>

<template>
  <div class="flex min-h-screen">
    <!-- Persistent sidebar (desktop) -->
    <AppNav />

    <div class="flex min-w-0 flex-1 flex-col bg-muted">
      <!-- Slim brand bar (mobile only) -->
      <header
        class="flex items-center gap-3 border-b border-(--ui-border) bg-blue-900 px-4 py-2.5 text-white lg:hidden"
      >
        <NuxtLink to="/" :external="true" class="flex items-center gap-2.5">
          <FunctionBucketMark color="secondary" :monogram="false" class="size-6" />
          <span class="font-mono text-sm font-bold tracking-tight">function-bucket</span>
        </NuxtLink>
        <div class="ml-auto flex items-center gap-2">
          <ClientOnly>
            <UColorModeButton class="text-white/70 hover:bg-white/10 hover:text-white" />
          </ClientOnly>
          <UButton
            v-if="!isLoggedIn"
            :to="`${authAppUrl}/login`"
            :external="true"
            variant="ghost"
            class="text-white/85 hover:bg-white/10 hover:text-white"
          >
            Sign in
          </UButton>
        </div>
      </header>

      <main class="flex-1 pb-16 lg:pb-0">
        <slot />
      </main>

      <!-- Bottom tab bar + full-nav drawer (mobile) -->
      <AppNavMobile />
    </div>
  </div>
</template>
