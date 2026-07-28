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

  <!-- logged in: workspace cards (the sidebar switcher's tree, laid out as tenant cards) -->
  <div
    v-else
    class="mx-auto max-w-5xl space-y-7 p-9 sm:px-12 sm:py-11"
  >
    <div>
      <h1 class="font-mono text-[28px] font-bold tracking-tight">
        hey, {{ firstName }}.
      </h1>
      <p class="mt-1 text-sm text-muted">
        your workspaces
      </p>
    </div>

    <!-- cards render instantly from localStorage claims; the background refresh rides on top -->
    <UProgress v-if="refreshing" size="xs" />

    <div
      v-if="roots.length === 0 && refreshing"
      class="flex flex-wrap items-start gap-4"
    >
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-28 basis-full sm:basis-[calc(50%-0.5rem)] lg:basis-[calc(33.333%-0.75rem)]"
      />
    </div>

    <UEmpty
      v-else-if="roots.length === 0"
      icon="i-lucide-building-2"
      label="no workspaces yet"
      description="ask your admin for an invitation"
    />

    <div
      v-else
      class="flex flex-wrap items-start gap-4"
    >
      <UCard
        v-for="node in roots"
        :key="node.tenantId"
        class="min-w-0 basis-full sm:basis-[calc(50%-0.5rem)] lg:basis-[calc(33.333%-0.75rem)]"
        :title="isInSupportMode ? 'Exit support to switch' : undefined"
      >
        <!-- header = the root tenant itself (a selectable node) -->
        <template #header>
          <component
            :is="headerClickable(node) ? 'button' : 'div'"
            :type="headerClickable(node) ? 'button' : undefined"
            class="flex w-full min-w-0 items-center gap-2"
            :class="headerClickable(node) ? 'cursor-pointer text-left hover:text-primary' : ''"
            @click="onSelect(node)"
          >
            <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
            <span
              class="truncate font-medium"
              :class="node.canEnter || node.isCurrent ? '' : 'text-muted'"
            >
              {{ node.tenantName }}
            </span>
            <UBadge
              v-if="node.isCurrent"
              color="primary"
              variant="subtle"
              size="sm"
            >
              Current
            </UBadge>
            <UBadge
              v-else-if="statusBadge(node)"
              :color="statusBadge(node)!.color"
              variant="subtle"
              size="sm"
            >
              {{ statusBadge(node)!.label }}
            </UBadge>
            <span class="ml-auto flex shrink-0 items-center">
              <UIcon
                v-if="switchingTenantId === node.tenantId"
                name="i-lucide-loader-circle"
                class="size-4 animate-spin"
              />
              <UIcon
                v-else-if="node.residentId === null"
                name="i-lucide-lock"
                class="size-4 text-muted"
                title="No residency in this workspace"
              />
            </span>
          </component>
        </template>

        <!-- body = the workspace tree under this tenant; header-only card when childless -->
        <template v-if="node.children.length > 0" #default>
          <ResidencyTree
            :nodes="node.children"
            :disabled="switching || isInSupportMode"
            :switching-tenant-id="switchingTenantId"
            @select="onSelect"
          />
        </template>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ResidencySwitchNode } from '@function-bucket/fnb-auth-layer/app/composables/useResidencySwitcher'

const { isLoggedIn, user, refreshClaims } = useAuth()
const { roots, switchResidency } = useResidencySwitcher()
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

const firstName = computed(() => (user.value?.displayName ?? 'there').split(/\s+/)[0])

// Support mode: cards are display-only — switching would silently drop the support session
// (same rule as the sidebar switcher's static trigger).
const isInSupportMode = computed(() => user.value?.permissions?.includes('p:exit-support') ?? false)

const refreshing = ref(false) // on-mount refreshClaims in flight → UProgress
const switching = ref(false) // a switch is in flight — the full reload ends it
const switchingTenantId = ref<string | null>(null)

// Cards render from current claims immediately; the background refresh updates the tree if
// changed. Refresh failure keeps the last-known tree (claims are still valid locally) and toasts.
onMounted(() => {
  if (!isLoggedIn.value) return
  refreshing.value = true
  refreshClaims()
    .catch(() => {
      toast.add({ title: 'Could not refresh workspaces', color: 'error' })
    })
    .finally(() => {
      refreshing.value = false
    })
})

function headerClickable(node: ResidencySwitchNode) {
  return node.canEnter && node.residentId !== null && !isInSupportMode.value
}

// Same disabled/muted priority as ResidencyTree.vue: ghosts show a lock; non-enterable
// residencies show why as a status badge (UC1 shared tenant/resident maps).
function statusBadge(node: ResidencySwitchNode) {
  if (node.isCurrent || node.canEnter || node.residentId === null) return null
  if (node.tenantStatus !== 'ACTIVE') {
    return { color: statusColor('tenant', node.tenantStatus), label: statusLabel(node.tenantStatus) }
  }
  return {
    color: statusColor('resident', node.residentStatus),
    label: statusLabel(node.residentStatus),
  }
}

async function onSelect(node: ResidencySwitchNode) {
  if (!node.canEnter || node.residentId === null || switching.value || isInSupportMode.value) return
  switching.value = true
  switchingTenantId.value = node.tenantId
  try {
    // assumeResidency → refreshClaims → full reload home; the reload ends the interaction.
    await switchResidency(node.residentId)
  } catch {
    toast.add({ title: 'Failed to switch workspace', color: 'error' })
    switching.value = false
    switchingTenantId.value = null
  }
}
</script>
