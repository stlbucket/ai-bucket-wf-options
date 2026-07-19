<script setup lang="ts">
import type { Tenant } from '@function-bucket/fnb-types'
import { useSiteAdminTenant, useBecomeSupport } from '~/composables/useSiteAdminTenants'

const route = useRoute()
const toast = useToast()
const router = useRouter()
const { user, refreshClaims } = useAuth()

const canSupport = computed(
  () =>
    user.value?.permissions?.includes('p:app-admin-support')
    || user.value?.permissions?.includes('p:app-admin-super')
)

const { data: tenant, refresh, activate, deactivate, update } = await useSiteAdminTenant(String(route.params.id))
const { becomeSupportForTenant } = useBecomeSupport()

const editing = ref(false)
const saving = ref(false)
const form = reactive({ name: '', identifier: '' as string | undefined, type: '' })

function startEdit() {
  form.name = tenant.value!.name
  form.identifier = tenant.value!.identifier || undefined
  form.type = String(tenant.value!.type)
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

async function save() {
  saving.value = true
  try {
    await update({ name: form.name, identifier: form.identifier, type: form.type })
    editing.value = false
    toast.add({ title: 'Tenant updated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to update tenant', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function handleActivate() {
  try {
    await activate()
    toast.add({ title: 'Tenant activated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to activate tenant', color: 'error' })
  }
}

async function handleDeactivate() {
  try {
    await deactivate()
    toast.add({ title: 'Tenant deactivated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to deactivate tenant', color: 'error' })
  }
}

async function onSupport(t: Tenant) {
  try {
    await becomeSupportForTenant(t.id)
    await refreshClaims()
    toast.add({ title: `Now supporting ${t.name}`, color: 'success' })
    navigateTo('/', { external: true })
    // router.push('/')
  } catch {
    toast.add({ title: 'Failed to enter support mode', color: 'error' })
  }
}

const typeOptions = ['anchor', 'customer', 'demo', 'test', 'trial'].map(v => ({
  label: v,
  value: v
}))
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4 p-6 sm:p-9">
    <UButton
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      to="/site-admin/tenant"
      size="sm"
      class="-ml-2 text-muted"
    >
      Tenants
    </UButton>

    <UCard v-if="tenant">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h1 class="text-lg font-semibold">
              {{ tenant.name }}
            </h1>
            <UBadge
              :color="statusColor('tenant', String(tenant.status))"
              variant="subtle"
              size="sm"
            >
              {{ statusLabel(String(tenant.status)) }}
            </UBadge>
          </div>
          <div class="flex gap-2">
            <SupportButton
              :tenant="tenant"
              :can-support="canSupport"
              @confirm="onSupport"
            />
            <UButton
              v-if="!editing"
              size="sm"
              variant="outline"
              color="neutral"
              icon="i-lucide-pencil"
              @click="startEdit"
            >
              Edit
            </UButton>
            <UButton
              v-if="tenant.status !== 'ACTIVE'"
              size="sm"
              color="success"
              variant="outline"
              @click="handleActivate"
            >
              Activate
            </UButton>
            <UButton
              v-if="tenant.status === 'ACTIVE'"
              size="sm"
              color="warning"
              variant="outline"
              @click="handleDeactivate"
            >
              Deactivate
            </UButton>
          </div>
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <template v-if="!editing">
          <div class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
            <div class="text-muted">
              Name
            </div>
            <div>{{ tenant.name }}</div>
            <div class="text-muted">
              Identifier
            </div>
            <div>{{ tenant.identifier ?? '—' }}</div>
            <div class="text-muted">
              Type
            </div>
            <div>{{ tenant.type }}</div>
            <div class="text-muted">
              ID
            </div>
            <div class="font-mono text-xs">
              {{ tenant.id }}
            </div>
            <div class="text-muted">
              Created
            </div>
            <div>{{ new Date(tenant.createdAt).toLocaleString() }}</div>
            <div class="text-muted">
              Updated
            </div>
            <div>{{ new Date(tenant.updatedAt).toLocaleString() }}</div>
          </div>
        </template>

        <template v-else>
          <div class="flex flex-col gap-3">
            <UFormField label="Name">
              <UInput v-model="form.name" />
            </UFormField>
            <UFormField label="Identifier">
              <UInput
                v-model="form.identifier"
                placeholder="url-safe-identifier"
              />
            </UFormField>
            <UFormField label="Type">
              <USelect
                v-model="form.type"
                :items="typeOptions"
              />
            </UFormField>
            <div class="flex gap-2 pt-2">
              <UButton
                :loading="saving"
                @click="save"
              >
                Save
              </UButton>
              <UButton
                variant="ghost"
                color="neutral"
                @click="cancelEdit"
              >
                Cancel
              </UButton>
            </div>
          </div>
        </template>
      </div>
    </UCard>
  </div>
</template>
