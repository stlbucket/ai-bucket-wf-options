<script setup lang="ts">
import type { License } from '@function-bucket/fnb-types'
import type { SubscriptionPackDetail } from '@function-bucket/fnb-graphql-client-api'
import { useAdminResident, useSubtreeResidentDetail } from '~/composables/useAdminResidents'

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

// Read-only fallback (subtree roll-up): an RLS miss means the id belongs to a child-tenant
// residency — load it via the DEFINER read instead; management actions stay hidden.
const rlsMiss = computed(() => !fetching.value && !data.value)
const detailPause = computed(() => !rlsMiss.value)
const { data: subtreeDetail, error: subtreeError } = useSubtreeResidentDetail(
  String(route.params.id),
  detailPause
)
// Raw jsonb (siteUserById precedent): profile/resident keys are snake_case, enums lowercase.
const roResident = computed<Record<string, unknown> | null>(() => {
  const d = subtreeDetail.value as { resident?: Record<string, unknown> } | null
  return d?.resident ?? null
})
const roResidencies = computed(() => {
  const d = subtreeDetail.value as {
    residencies?: Array<{
      residentId: string
      tenantName: string
      residentType: string
      status: string
      licenses: Array<{ id: string, licenseTypeKey: string, status: string }>
    }>
  } | null
  return d?.residencies ?? []
})

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

// ResidentStatus arrives in GraphQL enum casing (UPPERCASE) — normalize once for the gates.
const status = computed(() => String(resident.value?.status ?? '').toUpperCase())
const isBlocked = computed(() => status.value === 'BLOCKED_INDIVIDUAL' || status.value === 'BLOCKED_TENANT')
const isActive = computed(() => status.value === 'ACTIVE')
const isInvited = computed(() => status.value === 'INVITED')

// Resend invitation for a pending invitee (SendInviteModal: send email / copy link). The trigger
// plugin injects the admin's own tenant from claims.
const resendOpen = ref(false)

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

    <!-- Read-only mode: child-tenant resident reached through the subtree roll-up -->
    <template v-if="rlsMiss">
      <UAlert
        v-if="roResident"
        color="info"
        variant="subtle"
        icon="i-lucide-eye"
        title="Read-only"
        :description="`This person is a resident of ${roResident.tenant_name}, not this tenant. Manage them from that tenant.`"
      />
      <UAlert
        v-else-if="subtreeError"
        color="error"
        variant="subtle"
        icon="i-lucide-shield-x"
        title="Not available"
        description="This resident is outside your tenant tree."
      />

      <UCard v-if="roResident">
        <template #header>
          <div class="flex items-center gap-3">
            <h1 class="text-lg font-semibold">
              {{ roResident.display_name ?? roResident.email }}
            </h1>
            <UBadge
              :color="statusColor('resident', String(roResident.status))"
              variant="subtle"
              size="sm"
            >
              {{ statusLabel(String(roResident.status)) }}
            </UBadge>
          </div>
        </template>
        <div class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
          <div class="text-muted">
            Email
          </div>
          <div>{{ roResident.email }}</div>
          <div class="text-muted">
            Tenant
          </div>
          <div>{{ roResident.tenant_name }}</div>
          <div class="text-muted">
            Type
          </div>
          <div>{{ roResident.type }}</div>
          <div class="text-muted">
            ID
          </div>
          <div class="font-mono text-xs">
            {{ roResident.id }}
          </div>
        </div>
      </UCard>

      <UCard v-if="roResidencies.length">
        <template #header>
          <h2 class="text-base font-semibold">
            Residencies in your tree
          </h2>
        </template>
        <ul class="flex flex-col gap-3">
          <li
            v-for="residency in roResidencies"
            :key="residency.residentId"
            class="flex flex-wrap items-center gap-2 text-sm"
          >
            <UBadge
              :color="statusColor('resident', residency.status)"
              variant="subtle"
              size="sm"
            >
              {{ residency.tenantName }}
            </UBadge>
            <span>{{ residency.residentType }}</span>
            <span class="text-muted">{{ statusLabel(residency.status) }}</span>
            <span
              v-if="residency.licenses.length"
              class="text-xs text-muted"
            >
              {{ residency.licenses.map((l) => l.licenseTypeKey).join(', ') }}
            </span>
          </li>
        </ul>
      </UCard>
    </template>

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
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="canAdmin && isInvited"
              size="sm"
              variant="outline"
              icon="i-lucide-mail"
              @click="resendOpen = true"
            >
              Resend invitation
            </UButton>
            <UButton
              v-if="canAdmin && resident.email"
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-lucide-key-round"
              :disabled="!isActive"
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

    <SendInviteModal
      v-if="resident"
      v-model:open="resendOpen"
      :resident="{ displayName: resident.displayName ?? null, email: String(resident.email) }"
    />

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

