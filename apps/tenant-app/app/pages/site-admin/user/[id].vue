<script setup lang="ts">
import { useSiteAdminUser } from '~/composables/useSiteAdminUsers'

const route = useRoute()
const toast = useToast()

const { data, refresh, setStatus, setResidentStatus, update } = await useSiteAdminUser(String(route.params.id))

const profile = computed(() => data.value?.profile)
const authUser = computed(() => data.value?.authUser)
const residents = computed(() => data.value?.residents ?? [])

const editing = ref(false)
const saving = ref(false)
const form = reactive({
  firstName: '' as string | null,
  lastName: '' as string | null,
  displayName: '' as string | null,
  phone: '' as string | null,
  identifier: '' as string | null,
  isPublic: false,
})

function startEdit() {
  form.firstName = profile.value!.firstName
  form.lastName = profile.value!.lastName
  form.displayName = profile.value!.displayName
  form.phone = profile.value!.phone
  form.identifier = profile.value!.identifier
  form.isPublic = profile.value!.isPublic
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

async function save() {
  saving.value = true
  try {
    await update({
      firstName: form.firstName,
      lastName: form.lastName,
      displayName: form.displayName,
      phone: form.phone,
      identifier: form.identifier,
      isPublic: form.isPublic,
    })
    editing.value = false
    toast.add({ title: 'User updated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to update user', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function onSetStatus(action: 'activate' | 'deactivate' | 'block') {
  try {
    await setStatus(action)
    toast.add({ title: `User ${action}d`, color: 'success' })
  } catch {
    toast.add({ title: `Failed to ${action} user`, color: 'error' })
  }
}

async function onSetResidentStatus(residentId: string, action: 'activate' | 'deactivate') {
  try {
    await setResidentStatus(residentId, action)
    toast.add({ title: `Residency ${action}d`, color: 'success' })
  } catch {
    toast.add({ title: `Failed to ${action} residency`, color: 'error' })
  }
}

function fmt(val: string | Date | null | undefined) {
  if (!val) return '—'
  return new Date(val).toLocaleString()
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4 p-6 sm:p-9">
    <UButton variant="link" color="neutral" icon="i-lucide-arrow-left" to="/site-admin/user" size="sm" class="-ml-2 text-muted">
      Users
    </UButton>
    <div class="flex flex-col md:flex-row gap-4">
      <div class="flex flex-col gap-4 flex-1">
        <!-- Profile Card -->
        <UCard v-if="profile">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">Profile</span>
                <h1 class="text-lg font-semibold">{{ profile.displayName ?? profile.email }}</h1>
                <UBadge :color="statusColor('profile', String(profile.status))" variant="subtle" size="sm">
                  {{ statusLabel(String(profile.status)) }}
                </UBadge>
              </div>
              <div class="flex gap-2">
                <template v-if="String(profile.status) === 'active'">
                  <UButton size="sm" color="warning" variant="outline" @click="onSetStatus('deactivate')">
                    Deactivate
                  </UButton>
                  <UButton size="sm" color="error" variant="outline" @click="onSetStatus('block')">
                    Block
                  </UButton>
                </template>
                <template v-else-if="String(profile.status) === 'inactive'">
                  <UButton size="sm" color="success" variant="outline" @click="onSetStatus('activate')">
                    Activate
                  </UButton>
                  <UButton size="sm" color="error" variant="outline" @click="onSetStatus('block')">
                    Block
                  </UButton>
                </template>
                <template v-else-if="String(profile.status) === 'blocked'">
                  <UButton size="sm" color="success" variant="outline" @click="onSetStatus('activate')">
                    Activate
                  </UButton>
                  <UButton size="sm" color="warning" variant="outline" @click="onSetStatus('deactivate')">
                    Deactivate
                  </UButton>
                </template>
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
              </div>
            </div>
          </template>

          <div class="flex flex-col gap-4">
            <template v-if="!editing">
              <div class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
                <div class="text-muted">Email</div>
                <div>{{ profile.email }}</div>
                <div class="text-muted">Full Name</div>
                <div>{{ profile.fullName ?? '—' }}</div>
                <div class="text-muted">Display Name</div>
                <div>{{ profile.displayName ?? '—' }}</div>
                <div class="text-muted">Identifier</div>
                <div>{{ profile.identifier ?? '—' }}</div>
                <div class="text-muted">Phone</div>
                <div>{{ profile.phone ?? '—' }}</div>
                <div class="text-muted">Public</div>
                <div>{{ profile.isPublic ? 'Yes' : 'No' }}</div>
                <div class="text-muted">ID</div>
                <div class="font-mono text-xs">{{ profile.id }}</div>
                <div class="text-muted">Created</div>
                <div>{{ fmt(profile.createdAt) }}</div>
                <div class="text-muted">Updated</div>
                <div>{{ fmt(profile.updatedAt) }}</div>
              </div>
            </template>

            <template v-else>
              <div class="flex flex-col gap-3">
                <UFormField label="First Name">
                  <UInput v-model="form.firstName" />
                </UFormField>
                <UFormField label="Last Name">
                  <UInput v-model="form.lastName" />
                </UFormField>
                <UFormField label="Display Name">
                  <UInput v-model="form.displayName" />
                </UFormField>
                <UFormField label="Identifier">
                  <UInput v-model="form.identifier" />
                </UFormField>
                <UFormField label="Phone">
                  <UInput v-model="form.phone" />
                </UFormField>
                <UFormField label="Public Profile">
                  <UCheckbox v-model="form.isPublic" />
                </UFormField>
                <div class="flex gap-2 pt-2">
                  <UButton :loading="saving" @click="save">Save</UButton>
                  <UButton variant="ghost" color="neutral" @click="cancelEdit">Cancel</UButton>
                </div>
              </div>
            </template>
          </div>
        </UCard>

        <!-- Auth Account Card -->
        <UCard v-if="authUser">
          <template #header>
            <div class="flex items-center gap-3">
              <span class="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">Auth Account</span>
              <UBadge v-if="authUser.emailConfirmedAt" color="success" variant="subtle" size="sm">
                Confirmed
              </UBadge>
              <UBadge v-else color="warning" variant="subtle" size="sm">Unconfirmed</UBadge>
            </div>
          </template>
          <div class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
            <div class="text-muted">Email</div>
            <div>{{ authUser.email }}</div>
            <div class="text-muted">Role</div>
            <div>{{ authUser.role ?? '—' }}</div>
            <div class="text-muted">Email Confirmed</div>
            <div>{{ fmt(authUser.emailConfirmedAt) }}</div>
            <div class="text-muted">Last Sign In</div>
            <div>{{ fmt(authUser.lastSignInAt) }}</div>
            <div class="text-muted">ID</div>
            <div class="font-mono text-xs">{{ authUser.id }}</div>
            <div class="text-muted">Created</div>
            <div>{{ fmt(authUser.createdAt) }}</div>
          </div>
        </UCard>
        <UCard v-else-if="profile">
          <template #header>
            <span class="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">Auth Account</span>
          </template>
          <p class="text-sm text-muted">No auth account found for this profile.</p>
        </UCard>
      </div>

      <div class="flex flex-col gap-4 flex-1">
        <!-- Residencies Card -->
        <UCard v-if="profile">
          <template #header>
            <div class="flex items-center gap-3">
              <span class="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">Residencies</span>
              <UBadge color="neutral" variant="subtle" size="sm">{{ residents.length }}</UBadge>
            </div>
          </template>
          <UEmpty v-if="!residents.length" icon="i-lucide-building-2" label="No residencies found." />
          <div v-else class="flex flex-col divide-y divide-default">
            <div
              v-for="resident in residents"
              :key="resident.id"
              class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-sm font-medium truncate">{{ resident.tenantName }}</span>
                <span class="font-mono text-xs text-muted truncate">{{ resident.id }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <UBadge :color="statusColor('resident', String(resident.status))" variant="subtle" size="sm">
                  {{ statusLabel(String(resident.status)) }}
                </UBadge>
                <UButton
                  v-if="['inactive', 'blocked_individual', 'invited'].includes(String(resident.status))"
                  size="xs"
                  color="success"
                  variant="outline"
                  @click="onSetResidentStatus(resident.id, 'activate')"
                >
                  Activate
                </UButton>
                <UButton
                  v-if="['active', 'supporting'].includes(String(resident.status))"
                  size="xs"
                  color="warning"
                  variant="outline"
                  @click="onSetResidentStatus(resident.id, 'deactivate')"
                >
                  Deactivate
                </UButton>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
