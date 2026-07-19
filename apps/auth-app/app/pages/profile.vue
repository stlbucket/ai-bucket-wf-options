<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user } = useAuth()
</script>

<template>
  <div class="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-8 p-6">
    <div class="text-center">
      <h1 class="text-3xl font-bold tracking-tight">
        Your Profile
      </h1>
    </div>

    <UButton to="/" :external="true" variant="ghost" color="neutral" icon="i-lucide-house" label="Home" />

    <!-- Password management is ZITADEL self-service now (stage-5 cutover; supersedes 0070) -->
    <div class="w-full max-w-md mx-auto">
      <UserProfile :user="user!" />
    </div>
  </div>
</template>
