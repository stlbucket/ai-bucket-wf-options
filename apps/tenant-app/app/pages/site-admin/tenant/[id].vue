<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Tenant } from '@function-bucket/fnb-types'
import type { TenantUserView, TenantSubscriptionView } from '~/composables/useSiteAdminTenants'
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

const { data: tenant, users, subscriptions, activate, deactivate, update } = await useSiteAdminTenant(String(route.params.id))
const { becomeSupportForTenant } = useBecomeSupport()

// Users card (site-admin tenant detail spec): every non-support resident of the viewed tenant.
// Read-only — inviting/re-inviting users happens from inside the tenant (support mode), never
// cross-tenant from here (user directive 2026-07-27).
const userColumns: TableColumn<TenantUserView>[] = [
  { accessorKey: 'displayName', header: 'User' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'licenseTypeKeys', header: 'Licenses' },
]

const subscriptionColumns: TableColumn<TenantSubscriptionView>[] = [
  { accessorKey: 'displayName', header: 'Pack' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'licenseCount', header: 'Licenses' },
]

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

// A nested tenant (has a parent) may only be one of the interchangeable nestable node types;
// a root tenant may only be a root type. The chk_nested_parent DB constraint is the backstop.
const ROOT_TYPES = ['anchor', 'customer', 'demo', 'test', 'trial']
const NESTED_TYPES = ['workspace', 'client', 'organization']
const isNestedTenant = computed(() => tenant.value?.parentTenantId != null)
const typeOptions = computed(() =>
  (isNestedTenant.value ? NESTED_TYPES : ROOT_TYPES).map(v => ({ label: v, value: v }))
)
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-4 p-6 sm:p-9">
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

    <UCard v-if="tenant">
      <template #header>
        <div class="flex items-center gap-2">
          <h2 class="text-base font-semibold">
            Users
          </h2>
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
          >
            {{ users.length }}
          </UBadge>
        </div>
      </template>

      <UEmpty
        v-if="!users.length"
        icon="i-lucide-users"
        label="No users yet — enter support mode to invite one."
      />
      <div
        v-else
        class="overflow-x-auto"
      >
        <UTable
          :data="users"
          :columns="userColumns"
          class="grow"
        >
          <template #displayName-cell="{ row }">
            <div class="flex flex-col">
              <span class="font-medium">
                {{ row.original.displayName ?? row.original.email.split('@')[0] }}
              </span>
              <span class="text-xs text-muted">{{ row.original.email }}</span>
            </div>
          </template>
          <template #status-cell="{ row }">
            <UBadge
              :color="statusColor('resident', row.original.status)"
              variant="subtle"
              size="sm"
            >
              {{ statusLabel(row.original.status) }}
            </UBadge>
          </template>
          <template #licenseTypeKeys-cell="{ row }">
            <div
              v-if="row.original.licenseTypeKeys.length"
              class="flex flex-wrap gap-1"
            >
              <UBadge
                v-for="key in row.original.licenseTypeKeys"
                :key="key"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                {{ key }}
              </UBadge>
            </div>
            <span
              v-else
              class="text-muted"
            >—</span>
          </template>
        </UTable>
      </div>
    </UCard>

    <UCard v-if="tenant">
      <template #header>
        <h2 class="text-base font-semibold">
          Subscriptions
        </h2>
      </template>

      <p
        v-if="!subscriptions.length"
        class="text-sm text-muted"
      >
        No subscriptions.
      </p>
      <div
        v-else
        class="overflow-x-auto"
      >
        <UTable
          :data="subscriptions"
          :columns="subscriptionColumns"
          class="grow"
        >
          <template #displayName-cell="{ row }">
            {{ row.original.displayName ?? row.original.licensePackKey }}
          </template>
          <template #status-cell="{ row }">
            <UBadge
              :color="statusColor('subscription', row.original.status)"
              variant="subtle"
              size="sm"
            >
              {{ statusLabel(row.original.status) }}
            </UBadge>
          </template>
        </UTable>
      </div>
    </UCard>

  </div>
</template>
