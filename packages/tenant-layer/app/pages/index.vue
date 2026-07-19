<script setup lang="ts">
import { useAuth } from '@function-bucket/fnb-auth-layer/app/composables/useAuth';
import { useRequestURL, useRoute } from 'nuxt/app';
import { computed } from 'vue';

const { isLoggedIn, user } = useAuth()

const requestUrl = useRequestURL()

const authUrl = computed(() => {
  return `${requestUrl.origin}`
})
</script>

<template>
  <div class="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-8 p-6">
    <div class="text-center">
      <h1 class="text-3xl font-bold tracking-tight">
        Welcome to fnb Auth - {{ isLoggedIn }}
      </h1>
    </div>

    <template v-if="isLoggedIn">
      <UCard
        v-if="user"
        class="w-full max-w-lg"
      >
        <template #header>
          <h2 class="text-lg font-semibold">
            /api/auth/me
          </h2>
        </template>
        <pre>{{ user }}</pre>
      </UCard>
    </template>

    <template v-else>
      <p class="text-muted">
        You are not signed in.
      </p>
      <UButton
        :to="`${authUrl}/login`"
        size="lg"
      >
        Login
      </UButton>
    </template>
  </div>
</template>
