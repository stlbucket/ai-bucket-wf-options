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

    <!-- Two columns (stack on mobile, UC5): profile claims | self-service change password
         (password-self-service spec). ZITADEL is still the credential store — the form posts the
         authenticated change-password route, which re-keys the caller's own ZITADEL user. -->
    <div class="grid w-full max-w-4xl gap-6 md:grid-cols-2 md:items-start">
      <UserProfile :user="user!" />
      <ChangePasswordForm />
    </div>

    <!-- Preferred notification method(s) — reads/writes notify GraphQL (the one data-bound card on
         this otherwise claims-only page). SMS is gated on phone verification (D13). -->
    <div class="w-full max-w-4xl">
      <NotificationPreferences />
    </div>
  </div>
</template>
