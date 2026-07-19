<script setup lang="ts">
import type { Tenant } from '@function-bucket/fnb-types'
import { useSiteAdminTenants, useBecomeSupport } from '~/composables/useSiteAdminTenants'

const { user, refreshClaims } = useAuth()
const router = useRouter()
const toast = useToast()

const { data: tenants } = await useSiteAdminTenants()
const { becomeSupportForTenant } = useBecomeSupport()

const canSupport = computed(
  () =>
    user.value?.permissions?.includes('p:app-admin-support')
    || user.value?.permissions?.includes('p:app-admin-super')
)

async function onSupport(tenant: Tenant) {
  try {
    await becomeSupportForTenant(tenant.id)
    await refreshClaims()
    toast.add({ title: `Now supporting ${tenant.name}`, color: 'success' })
    navigateTo('/', { external: true })
    // router.push('/')
  } catch {
    toast.add({ title: 'Failed to enter support mode', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader
      title="Tenants"
      :subtitle="`${(tenants ?? []).length} tenants across the platform`"
    />
    <div class="overflow-hidden rounded-[10px] border border-default bg-default">
      <TenantList
        :tenants="tenants ?? []"
        :can-support="canSupport"
        @support="onSupport"
      />
    </div>
  </div>
</template>
