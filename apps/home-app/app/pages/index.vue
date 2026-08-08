<template>
  <!-- Auth-aware branch is CLIENT-ONLY: `isLoggedIn` derives from claims in localStorage, which
       is unreadable during SSR, so a top-level v-if here would render the signed-out shell on the
       server and the signed-in view on the client → hydration mismatch. Vue then reconciles the
       two divergent trees in place, stranding the signed-in UTabs list + panels as the two direct
       children of the signed-out lg:grid-cols-2 grid — the "tabs and content in two columns on
       wide screens" bug. `<ClientOnly>` renders the signed-out landing on the server (and until
       hydration) via #fallback, then mounts the real branch fresh on the client. -->
  <ClientOnly>
    <!-- logged in: one column at every width — a single tab strip with Workspaces folded in as
         the first, default-selected tab (no greeting, both breakpoints) -->
    <div
      v-if="isLoggedIn"
      class="mx-auto max-w-3xl p-9 sm:px-12 sm:py-11"
    >
      <HomeNarrative with-workspaces>
        <template #workspaces>
          <WorkspaceCards />
        </template>
      </HomeNarrative>
    </div>

    <!-- logged out (client): two-column — description (left) + hero/sign-in (right) -->
    <HomeSignedOut v-else />

    <!-- server + pre-hydration: the public landing stays SSR'd -->
    <template #fallback>
      <HomeSignedOut />
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
const { isLoggedIn } = useAuth()

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
