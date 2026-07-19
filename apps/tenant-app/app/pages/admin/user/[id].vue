<script setup lang="ts">
import type { License } from '@function-bucket/fnb-types'
import type { SubscriptionPackDetail } from '@function-bucket/fnb-graphql-client-api'
import { useAdminResident } from '~/composables/useAdminResidents'

const route = useRoute()
const toast = useToast()

const {
  data,
  fetching,
  blockResident,
  unblockResident,
  grantResidentLicense,
  revokeResidentLicense
} = useAdminResident(String(route.params.id))

const resident = computed(() => data.value?.resident)
const licenses = computed(() => (data.value?.licenses ?? []) as unknown as License[])
const subscriptionPacks = computed(
  () => (data.value?.subscriptionPacks ?? []) as unknown as SubscriptionPackDetail[]
)

const isBlocked = computed(() => {
  const s = String(resident.value?.status ?? '')
  return s === 'blocked_individual' || s === 'blocked_tenant'
})

async function block() {
  try {
    await blockResident()
    toast.add({ title: 'Resident blocked', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to block resident', color: 'error' })
  }
}

async function unblock() {
  try {
    await unblockResident()
    toast.add({ title: 'Resident unblocked', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to unblock resident', color: 'error' })
  }
}

async function grantLicense(licenseTypeKey: string) {
  try {
    await grantResidentLicense(licenseTypeKey)
    toast.add({ title: 'License granted', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to grant license', color: 'error' })
  }
}

async function revokeLicense(licenseId: string) {
  try {
    await revokeResidentLicense(licenseId)
    toast.add({ title: 'License revoked', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to revoke license', color: 'error' })
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4 p-6 sm:p-9">
    <UButton
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      to="/admin/user"
      size="sm"
      class="-ml-2 text-muted"
    >
      Residents
    </UButton>

    <UCard v-if="resident">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h1 class="text-lg font-semibold">
              {{ resident.displayName ?? resident.email }}
            </h1>
            <UBadge
              :color="statusColor('resident', String(resident.status))"
              variant="subtle"
              size="sm"
            >
              {{ statusLabel(String(resident.status)) }}
            </UBadge>
          </div>
          <div class="flex gap-2">
            <UButton
              v-if="!isBlocked"
              size="sm"
              color="error"
              variant="outline"
              @click="block"
            >
              Block
            </UButton>
            <UButton
              v-else
              size="sm"
              color="success"
              variant="outline"
              @click="unblock"
            >
              Unblock
            </UButton>
          </div>
        </div>
      </template>
      <div class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
        <div class="text-muted">
          Email
        </div>
        <div>{{ resident.email }}</div>
        <div class="text-muted">
          Type
        </div>
        <div>{{ resident.type }}</div>
        <div class="text-muted">
          ID
        </div>
        <div class="font-mono text-xs">
          {{ resident.id }}
        </div>
      </div>
    </UCard>

    <template v-if="!fetching && data">
      <div
        v-if="subscriptionPacks.length"
        class="flex flex-col gap-3"
      >
        <h2 class="text-base font-semibold">
          License Assignments
        </h2>
        <LicenseAssignment
          v-for="pack in subscriptionPacks"
          :key="pack.subscription.id"
          :subscription-pack="pack"
          :resident-licenses="licenses"
          @grant="grantLicense"
          @revoke="revokeLicense"
        />
      </div>
      <UEmpty
        v-else
        icon="i-lucide-package-x"
        label="No subscription packs available for this tenant."
      />
    </template>
  </div>
</template>
