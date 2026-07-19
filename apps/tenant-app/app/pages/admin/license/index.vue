<script setup lang="ts">
import type { License } from '@function-bucket/fnb-types'
import { useAdminLicenses } from '~/composables/useAdminLicenses'

const toast = useToast()
const { data, fetching } = useAdminLicenses()

const licenses = computed(() => (data.value?.licenses ?? []) as unknown as License[])
const residents = computed(() => data.value?.residents ?? [])

const residentMap = computed(() =>
  Object.fromEntries(residents.value.map(r => [r.id, r]))
)

const licenseTypeKeys = computed(() =>
  [...new Set(licenses.value.map(l => l.licenseTypeKey as string))].sort()
)

const selectedTypes = ref<Set<string>>(new Set())

watch(licenseTypeKeys, (keys) => {
  selectedTypes.value = new Set(keys)
}, { immediate: true })

function toggleType(key: string) {
  const next = new Set(selectedTypes.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedTypes.value = next
}

const allTypesSelected = computed(() => selectedTypes.value.size === licenseTypeKeys.value.length)
function toggleAllTypes() {
  selectedTypes.value = allTypesSelected.value ? new Set() : new Set(licenseTypeKeys.value)
}

const statusKeys = computed(() =>
  [...new Set(licenses.value.map(l => l.status as string))].sort()
)

const selectedStatuses = ref<Set<string>>(new Set())

watch(statusKeys, (keys) => {
  selectedStatuses.value = new Set(keys)
}, { immediate: true })

function toggleStatus(key: string) {
  const next = new Set(selectedStatuses.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedStatuses.value = next
}

const allStatusesSelected = computed(() => selectedStatuses.value.size === statusKeys.value.length)
function toggleAllStatuses() {
  selectedStatuses.value = allStatusesSelected.value ? new Set() : new Set(statusKeys.value)
}

const search = ref('')

const filteredLicenses = computed(() => {
  const q = search.value.trim().toLowerCase()
  return licenses.value.filter((l) => {
    if (!selectedTypes.value.has(l.licenseTypeKey as string)) return false
    if (!selectedStatuses.value.has(l.status as string)) return false
    if (!q) return true
    const r = residentMap.value[l.residentId as string]
    return r?.displayName?.toLowerCase().includes(q) || r?.email?.toLowerCase().includes(q)
  })
})

function onActivate(_id: string) {
  toast.add({ title: 'License activation not available yet', color: 'warning' })
}

function onDeactivate(_id: string) {
  toast.add({ title: 'License deactivation not available yet', color: 'warning' })
}
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Licenses" :subtitle="`${licenses.length} licenses issued`" />

    <div class="flex flex-col gap-4">
        <!-- Filter bar -->
        <div class="flex flex-wrap items-center gap-3">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search by name or email…"
            class="w-56"
            :trailing-icon="search ? 'i-lucide-x' : undefined"
            @click:trailing="search = ''"
          />

          <USeparator
            orientation="vertical"
            class="h-6 hidden sm:block"
          />

          <div
            v-if="statusKeys.length"
            class="flex items-center gap-3"
          >
            <span class="text-xs font-semibold uppercase tracking-wider text-muted">Status</span>
            <UCheckbox
              :model-value="allStatusesSelected"
              label="All"
              :indeterminate="selectedStatuses.size > 0 && !allStatusesSelected"
              @update:model-value="toggleAllStatuses"
            />
            <UCheckbox
              v-for="key in statusKeys"
              :key="key"
              :model-value="selectedStatuses.has(key)"
              :label="key"
              @update:model-value="toggleStatus(key)"
            />
          </div>

          <USeparator
            orientation="vertical"
            class="h-6 hidden sm:block"
          />

          <div
            v-if="licenseTypeKeys.length"
            class="flex flex-wrap items-center gap-3"
          >
            <span class="text-xs font-semibold uppercase tracking-wider text-muted">Type</span>
            <UCheckbox
              :model-value="allTypesSelected"
              label="All"
              :indeterminate="selectedTypes.size > 0 && !allTypesSelected"
              @update:model-value="toggleAllTypes"
            />
            <UCheckbox
              v-for="key in licenseTypeKeys"
              :key="key"
              :model-value="selectedTypes.has(key)"
              :label="key"
              @update:model-value="toggleType(key)"
            />
          </div>
        </div>

        <UEmpty
          v-if="fetching"
          icon="i-lucide-loader"
          label="Loading licenses…"
        />
        <div v-else class="overflow-hidden rounded-[10px] border border-default bg-default">
          <LicenseList
            :licenses="filteredLicenses"
            :residents="residents"
            @activate="onActivate"
            @deactivate="onDeactivate"
          />
        </div>
      </div>
  </div>
</template>
