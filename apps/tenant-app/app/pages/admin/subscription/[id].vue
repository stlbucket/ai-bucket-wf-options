<script setup lang="ts">
import { useAdminSubscription } from '~/composables/useAdminSubscriptions'

const route = useRoute()
const toast = useToast()

const { data, fetching, deactivateSubscription, reactivateSubscription } = useAdminSubscription(
  String(route.params.id),
)

const subscription = computed(() => data.value?.subscription)
const licensePack = computed(() => data.value?.licensePack)
const licenseTypes = computed(() => data.value?.licenseTypes ?? [])
const licensePackLicenseTypes = computed(() => data.value?.licensePackLicenseTypes ?? [])
const licenses = computed(() => data.value?.licenses ?? [])
const residents = computed(() => data.value?.residents ?? [])

const residentMap = computed(() =>
  Object.fromEntries(residents.value.map((r) => [String(r.id), r])),
)

const licenseTypeMap = computed(() =>
  Object.fromEntries(licenseTypes.value.map((lt) => [lt.key, lt])),
)

type LicenseTypeSummary = {
  licenseType: { key: string; displayName: string; assignmentScope: string } | undefined
  numberOfLicenses: number
  issuedCount: number
  assignmentScope: string
}

const licenseTypeSummaries = computed<LicenseTypeSummary[]>(() =>
  licensePackLicenseTypes.value.map((lplt) => {
    const lt = licenseTypeMap.value[lplt.licenseTypeKey]
    const issued = licenses.value.filter(
      (l) => l.licenseTypeKey === lplt.licenseTypeKey && l.status === 'ACTIVE',
    ).length
    return {
      licenseType: lt,
      numberOfLicenses: lplt.numberOfLicenses,
      issuedCount: issued,
      assignmentScope: lt ? String(lt.assignmentScope) : '—',
    }
  }),
)

function fmt(val: string | null | undefined) {
  if (!val) return '—'
  return new Date(val).toLocaleString()
}

async function deactivate() {
  try {
    await deactivateSubscription()
    toast.add({ title: 'Subscription deactivated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to deactivate subscription', color: 'error' })
  }
}

async function reactivate() {
  try {
    await reactivateSubscription()
    toast.add({ title: 'Subscription reactivated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to reactivate subscription', color: 'error' })
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4 p-6 sm:p-9">
    <UButton
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      to="/admin/subscription"
      size="sm"
      class="-ml-2 text-muted"
    >
      Subscriptions
    </UButton>

    <template v-if="fetching">
      <UCard>
        <UEmpty icon="i-lucide-loader" label="Loading…" />
      </UCard>
    </template>

    <template v-else-if="subscription">
      <!-- Summary card -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <h1 class="text-lg font-semibold">
                {{ licensePack?.displayName ?? subscription.licensePackKey }}
              </h1>
              <UBadge
                :color="statusColor('subscription', String(subscription.status))"
                variant="subtle"
                size="sm"
              >
                {{ statusLabel(String(subscription.status)) }}
              </UBadge>
            </div>
            <div class="flex gap-2">
              <UButton
                v-if="subscription.status === 'ACTIVE'"
                size="sm"
                color="warning"
                variant="outline"
                @click="deactivate"
              >
                Deactivate
              </UButton>
              <UButton
                v-else
                size="sm"
                color="success"
                variant="outline"
                @click="reactivate"
              >
                Reactivate
              </UButton>
            </div>
          </div>
        </template>
        <div class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
          <div class="text-muted">Pack Key</div>
          <div class="font-mono text-xs">{{ subscription.licensePackKey }}</div>
          <template v-if="licensePack">
            <div class="text-muted">Description</div>
            <div>{{ licensePack.description || '—' }}</div>
            <div class="text-muted">Auto Subscribe</div>
            <div>{{ licensePack.autoSubscribe ? 'Yes' : 'No' }}</div>
          </template>
          <div class="text-muted">Subscription ID</div>
          <div class="font-mono text-xs">{{ subscription.id }}</div>
          <div class="text-muted">Created</div>
          <div>{{ fmt(subscription.createdAt) }}</div>
          <div class="text-muted">Updated</div>
          <div>{{ fmt(subscription.updatedAt) }}</div>
        </div>
      </UCard>

      <!-- License types -->
      <UCard v-if="licenseTypeSummaries.length">
        <template #header>
          <div class="flex items-center gap-3">
            <span class="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">License Types</span>
            <UBadge color="neutral" variant="subtle" size="sm">
              {{ licenseTypeSummaries.length }}
            </UBadge>
          </div>
        </template>
        <div class="divide-y divide-default">
          <div
            v-for="summary in licenseTypeSummaries"
            :key="summary.licenseType?.key ?? ''"
            class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 text-sm"
          >
            <div class="flex flex-col gap-0.5 min-w-0">
              <span class="font-medium">{{ summary.licenseType?.displayName ?? summary.licenseType?.key }}</span>
              <span class="text-xs font-mono text-muted">{{ summary.licenseType?.key }}</span>
            </div>
            <div class="flex items-center gap-4 shrink-0 text-right">
              <div class="flex flex-col items-end">
                <span class="text-xs text-muted">Issued / Allowed</span>
                <span :class="summary.issuedCount >= summary.numberOfLicenses ? 'text-warning font-medium' : ''">
                  {{ summary.issuedCount }} / {{ summary.numberOfLicenses }}
                </span>
              </div>
              <UBadge color="neutral" variant="subtle" size="sm">
                {{ summary.assignmentScope }}
              </UBadge>
            </div>
          </div>
        </div>
      </UCard>

      <!-- License holders -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-3">
            <span class="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">License Holders</span>
            <UBadge color="neutral" variant="subtle" size="sm">
              {{ licenses.length }}
            </UBadge>
          </div>
        </template>
        <UEmpty
          v-if="!licenses.length"
          icon="i-lucide-users"
          label="No licenses issued under this subscription."
        />
        <div v-else class="divide-y divide-default">
          <div
            v-for="license in licenses"
            :key="license.id"
            class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 text-sm"
          >
            <div class="flex flex-col gap-0.5 min-w-0">
              <NuxtLink
                :to="`/admin/user/${license.residentId}`"
                class="font-medium hover:underline truncate"
              >
                {{ residentMap[license.residentId]?.displayName ?? residentMap[license.residentId]?.email ?? license.residentId }}
              </NuxtLink>
              <span class="text-xs text-muted font-mono">{{ license.licenseTypeKey }}</span>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <span v-if="license.expiresAt" class="text-xs text-muted">
                Expires {{ new Date(license.expiresAt).toLocaleDateString() }}
              </span>
              <UBadge :color="statusColor('license', String(license.status))" variant="subtle" size="sm">
                {{ statusLabel(String(license.status)) }}
              </UBadge>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
