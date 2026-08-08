<script setup lang="ts">
// The public, logged-out landing: two-column marketing (narrative left, brand mark + sign-in
// right). Extracted from the home page so it can render both as the `<ClientOnly>` SSR fallback
// and as the client-side signed-out branch without duplicating the markup (see pages/index.vue
// for why the auth branch must be client-only — claims live in localStorage).
const { public: { authAppUrl } } = useRuntimeConfig()
</script>

<template>
  <div class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center p-8">
    <div class="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <!-- left: what function-bucket is / how it's built / for developers -->
      <!-- mobile shows the sign-in first (order-2 here); lg restores text-left/hero-right -->
      <div class="order-2 space-y-5 lg:order-1">
        <h1 class="font-mono text-4xl font-bold tracking-tight">
          function-bucket
        </h1>
        <HomeNarrative />
      </div>

      <!-- right: brand mark + sign-in -->
      <div class="order-1 flex flex-col items-center gap-8 lg:order-2">
        <FunctionBucketMark size="lg" />
        <p class="text-lg text-muted">
          your tools. in a bucket.
        </p>
        <div class="flex flex-col items-center gap-3">
          <UButton
            :href="`${authAppUrl}/login`"
            :external="true"
            size="xl"
            label="sign in"
          />
          <ULink
            :href="`${authAppUrl}/forgot-password`"
            :external="true"
            class="text-sm text-muted hover:text-default"
          >
            forgot password?
          </ULink>
        </div>
      </div>
    </div>
  </div>
</template>
