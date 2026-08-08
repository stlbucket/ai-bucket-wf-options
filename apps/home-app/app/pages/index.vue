<template>
  <!-- logged out: two-column — description (left) + hero/sign-in (right) -->
  <div
    v-if="!isLoggedIn"
    class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center p-8"
  >
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

  <!-- logged in: one column at every width — greeting on top, then a single tab strip
       with Workspaces folded in as the first, default-selected tab -->
  <div
    v-else
    class="mx-auto max-w-3xl p-9 sm:px-12 sm:py-11"
  >
    <h1 class="mb-6 font-mono text-[28px] font-bold tracking-tight">
      hey, {{ firstName }}.
    </h1>

    <HomeNarrative with-workspaces>
      <template #workspaces>
        <WorkspaceCards />
      </template>
    </HomeNarrative>
  </div>
</template>

<script setup lang="ts">
const { isLoggedIn, user } = useAuth()
const { public: { authAppUrl } } = useRuntimeConfig()

const firstName = computed(() => (user.value?.displayName ?? 'there').split(/\s+/)[0])

// Stale-claims recovery landing (claims-revalidation-pattern.md): the hydrate-claims plugin
// redirects here with ?session=expired after clearing dead localStorage claims. One-shot toast
// (UC7), then strip the param so a refresh/bookmark doesn't re-toast.
const route = useRoute()
const router = useRouter()
const toast = useToast()
onMounted(() => {
  if (route.query.session !== 'expired') return
  toast.add({
    title: 'signed out',
    description: 'your session ended — sign in to continue',
    color: 'warning'
  })
  router.replace({ query: { ...route.query, session: undefined } })
})
</script>
