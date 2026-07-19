<template>
  <!-- logged out: hero -->
  <div
    v-if="!isLoggedIn"
    class="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-8 p-8"
  >
    <FunctionBucketMark size="lg" />
    <div class="text-center space-y-2">
      <h1 class="text-5xl font-bold font-mono tracking-tight">
        function-bucket
      </h1>
      <p class="text-muted text-lg">
        your tools. in a bucket.
      </p>
    </div>
    <UButton
      :href="`${authAppUrl}/login`"
      :external="true"
      size="xl"
      label="sign in"
    />
  </div>

  <!-- logged in: dashboard -->
  <div
    v-else
    class="mx-auto max-w-[760px] space-y-7 p-9 sm:px-12 sm:py-11"
  >
    <div>
      <h1 class="font-mono text-[28px] font-bold tracking-tight">
        hey, {{ firstName }}.
      </h1>
      <p class="mt-1 text-sm text-muted">
        here's what's in your bucket
      </p>

      <!-- tenant / workspace context chips (display-only; the switcher lives in the sidebar) -->
      <div
        v-if="tenantChip"
        class="mt-3.5 flex flex-wrap items-center gap-2"
      >
        <span
          class="inline-flex items-center gap-[7px] rounded-md border border-primary/18 bg-primary/8 px-2.5 py-[5px] font-mono text-xs font-semibold text-primary"
        >
          <UIcon name="i-lucide-building-2" class="size-[13px] shrink-0" />
          {{ tenantChip }}
        </span>
        <template v-if="workspaceChip">
          <span class="font-mono text-xs text-dimmed">/</span>
          <span
            class="inline-flex items-center gap-[7px] rounded-md border border-secondary/18 bg-secondary/8 px-2.5 py-[5px] font-mono text-xs font-semibold text-secondary"
          >
            <UIcon name="i-lucide-layers" class="size-[13px] shrink-0" />
            {{ workspaceChip }}
          </span>
        </template>
      </div>
    </div>

    <div
      v-if="availableSections.length > 0"
      class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-x-12 gap-y-9"
    >
      <section
        v-for="(s, si) in availableSections"
        :key="s.key"
        class="flex flex-col gap-1.5"
      >
        <div class="flex items-center gap-2.5 pb-2">
          <UIcon
            :name="s.icon"
            class="size-[15px] shrink-0"
            :style="{ color: accents[si % accents.length] }"
          />
          <span class="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            {{ s.label }}
          </span>
          <span class="font-mono text-[11px] font-semibold text-dimmed">
            {{ String(s.items.length).padStart(2, '0') }}
          </span>
          <span class="h-px flex-1 border-t border-default" />
        </div>

        <NuxtLink
          v-for="(item, ii) in s.items"
          :key="item.key"
          :to="item.route"
          :external="true"
          class="-mx-2.5 flex items-center gap-3 rounded-lg border-b border-muted p-2.5 transition-colors last:border-b-0 hover:bg-default"
        >
          <UIcon
            :name="item.icon"
            class="size-[18px] shrink-0"
            :style="{ color: rowAccent(si, ii) }"
          />
          <span class="text-[15px] font-medium">{{ item.label }}</span>
          <span class="ml-auto text-[13px] text-dimmed">→</span>
        </NuxtLink>
      </section>
    </div>

    <UEmpty
      v-else
      icon="i-lucide-package-open"
      label="nothing in the bucket yet"
      description="ask your admin for access to some tools"
    />
  </div>
</template>

<script setup lang="ts">
const { isLoggedIn, user } = useAuth()
const { availableSections } = useAppNav()
const { public: { authAppUrl } } = useRuntimeConfig()

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
    color: 'warning',
  })
  router.replace({ query: { ...route.query, session: undefined } })
})

// Icon accent cycled globally across all tool rows in page order — deliberately does NOT
// reset per module (mock: blue/green/warn). Module header icons use the section index.
const accents = ['var(--ui-primary)', 'var(--ui-secondary)', 'var(--ui-warning)']

const sectionOffsets = computed(() => {
  const offsets: number[] = []
  let total = 0
  for (const s of availableSections.value) {
    offsets.push(total)
    total += s.items.length
  }
  return offsets
})
const rowAccent = (si: number, ii: number) =>
  accents[((sectionOffsets.value[si] ?? 0) + ii) % accents.length]

// Context chips: when the current residency is a workspace, the first chip shows its parent
// tenant and the second the workspace itself; otherwise one tenant chip, no separator.
// Same derivation as use-residency-switcher.ts (residentId matched against residencies).
const currentResidency = computed(() => {
  const residentId = user.value?.residentId
  if (!residentId) return null
  return user.value?.residencies?.find((r) => r.residentId === residentId) ?? null
})
const workspaceParent = computed(() => {
  const cur = currentResidency.value
  if (cur?.tenantType !== 'WORKSPACE' || !cur.parentTenantId) return null
  return user.value?.residencies?.find((r) => r.tenantId === cur.parentTenantId) ?? null
})
const tenantChip = computed(() =>
  workspaceParent.value ? workspaceParent.value.tenantName : (user.value?.tenantName ?? null),
)
const workspaceChip = computed(() =>
  workspaceParent.value
    ? (currentResidency.value?.tenantName ?? user.value?.tenantName ?? null)
    : null,
)

const firstName = computed(() => (user.value?.displayName ?? 'there').split(/\s+/)[0])
</script>
