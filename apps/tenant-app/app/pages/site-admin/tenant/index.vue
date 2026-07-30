<script setup lang="ts">
import type { Tenant } from '@function-bucket/fnb-types'
import type { NewTenantPayload } from '~/components/NewTenantModal.vue'
import { useSiteAdminTenants, useBecomeSupport, useCreateTenant } from '~/composables/useSiteAdminTenants'

const { user, refreshClaims } = useAuth()
const router = useRouter()
const toast = useToast()

const { data: tenants } = await useSiteAdminTenants()
const { becomeSupportForTenant } = useBecomeSupport()
const { createTenant } = useCreateTenant()

const creating = ref(false)
const createModal = ref<{ reset: () => void } | null>(null)

async function onCreate(payload: NewTenantPayload) {
  creating.value = true
  try {
    const created = await createTenant(payload)
    createModal.value?.reset()
    toast.add({ title: `Tenant ${created.name} created`, color: 'success' })
    navigateTo(`/site-admin/tenant/${created.id}`)
  } catch (e) {
    const message = e instanceof Error && e.message.includes('30002')
      ? 'A tenant with this name already exists'
      : 'Failed to create tenant'
    toast.add({ title: message, color: 'error' })
  } finally {
    creating.value = false
  }
}

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
    <div class="flex flex-wrap items-center justify-between gap-3">
      <PageHeader
        title="Tenants"
        :subtitle="`${(tenants ?? []).length} tenants across the platform`"
      />
      <NewTenantModal
        ref="createModal"
        :creating="creating"
        @create="onCreate"
      />
    </div>
    <div class="overflow-hidden rounded-[10px] border border-default bg-default">
      <TenantList
        :tenants="tenants ?? []"
        :can-support="canSupport"
        @support="onSupport"
      />
    </div>
  </div>
</template>
