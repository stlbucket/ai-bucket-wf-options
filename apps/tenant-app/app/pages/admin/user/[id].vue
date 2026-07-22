<script setup lang="ts">
import type { License } from '@function-bucket/fnb-types'
import type { SubscriptionPackDetail } from '@function-bucket/fnb-graphql-client-api'
import { useAdminResident } from '~/composables/useAdminResidents'

const route = useRoute()
const toast = useToast()
const { user } = useAuth()

const {
  data,
  fetching,
  blockResident,
  unblockResident,
  grantResidentLicense,
  revokeResidentLicense
} = useAdminResident(String(route.params.id))

// Admin "send password reset" (password-self-service spec, admin-reset.data.md). Gated p:app-admin;
// the DB also enforces it (registry gate + app.resident RLS on the email shown here). Fires the same
// forgot-password workflow the public route hits — the admin never sets/learns the password.
const canAdmin = computed(() => user.value?.permissions?.includes('p:app-admin') ?? false)
const { reset: sendPasswordReset, fetching: resetting } = useAdminResetPassword()
const resetOpen = ref(false)

async function confirmReset() {
  const email = resident.value?.email
  if (!email) return
  try {
    await sendPasswordReset(String(email))
    toast.add({
      title: 'Reset link sent',
      description: `${email} will get an email to set a new password.`,
      color: 'success',
      icon: 'i-lucide-mail-check'
    })
    resetOpen.value = false
  } catch {
    toast.add({ title: 'Could not send reset link', color: 'error' })
  }
}

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
              v-if="canAdmin && resident.email"
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-lucide-key-round"
              @click="resetOpen = true"
            >
              Send password reset
            </UButton>
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

    <UModal
      v-model:open="resetOpen"
      title="Send password reset"
      description="Emails this user a link to set a new password."
    >
      <template #body>
        <p class="text-sm text-muted">
          This sends {{ resident?.displayName ?? resident?.email }} an email with a link to choose a
          new password. You won't see or set their password.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="resetOpen = false">
            Cancel
          </UButton>
          <UButton icon="i-lucide-mail" :loading="resetting" @click="confirmReset">
            Send reset link
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

