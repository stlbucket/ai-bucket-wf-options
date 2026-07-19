<script setup lang="ts">
import BreweryListView from '~/components/datasets/BreweryListView.vue'
import BreweryMapView from '~/components/datasets/BreweryMapView.vue'
import type { BreweryType } from '@function-bucket/fnb-types'

const toast = useToast()
const { user } = useAuth()

const { breweries, fetching, options, syncStatus, queueSync } = useBreweries()
const { points, fetching: pointsFetching, activate } = useBreweryMapPoints()

// default list; a page visit always starts on list (user decision)
const view = ref<'list' | 'map'>('list')
watch(view, (v) => {
  if (v === 'map') activate()
})

const canSync = computed(() => user.value?.permissions?.includes('p:app-admin-super') ?? false)
const inProgress = computed(() => syncStatus.value?.inProgress ?? false)

// ---- filters (debounced ~300ms into the composable's reactive options; list only) ----
const searchText = ref('')
const typeFilter = ref<BreweryType | undefined>(undefined)
const stateFilter = ref('')
const countryFilter = ref('')
const geolocatedOnly = ref(false)

const typeItems = (
  ['MICRO', 'NANO', 'REGIONAL', 'BREWPUB', 'TAPROOM', 'BEERGARDEN', 'CIDERY', 'CONTRACT', 'PROPRIETOR', 'PLANNING', 'CLOSED', 'LARGE', 'BAR', 'LOCATION', 'UNKNOWN'] as BreweryType[]
).map((value) => ({ label: value.toLowerCase(), value }))

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch([searchText, typeFilter, stateFilter, countryFilter, geolocatedOnly], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    options.value = {
      ...options.value,
      searchText: searchText.value || null,
      breweryType: typeFilter.value ?? null,
      state: stateFilter.value || null,
      country: countryFilter.value || null,
      isGeolocated: geolocatedOnly.value ? true : null,
      pageOffset: 0,
    }
  }, 300)
})

const filtersActive = computed(
  () =>
    !!(searchText.value || typeFilter.value || stateFilter.value || countryFilter.value)
    || geolocatedOnly.value,
)

function clearFilters() {
  searchText.value = ''
  typeFilter.value = undefined
  stateFilter.value = ''
  countryFilter.value = ''
  geolocatedOnly.value = false
}

// ---- pagination ----
const page = computed({
  get: () => options.value.pageOffset + 1,
  set: (p: number) => {
    options.value = { ...options.value, pageOffset: p - 1 }
  },
})

// exact total is only known unfiltered (sync status count); under filters, keep the
// pager open for another page while full pages come back
const total = computed(() => {
  if (!filtersActive.value) return syncStatus.value?.breweryCount ?? breweries.value.length
  const loaded = options.value.pageOffset * options.value.itemLimit + breweries.value.length
  return breweries.value.length === options.value.itemLimit
    ? loaded + options.value.itemLimit
    : loaded
})

// ---- header status line ----
function relativeTime(date: Date): string {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const table: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of table) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

const statusLine = computed(() => {
  const s = syncStatus.value
  if (s?.inProgress) return 'Sync in progress…'
  if (!s || s.breweryCount === 0) return 'No data yet — run a sync to load the dataset'
  const when = s.lastSyncedAt ? relativeTime(s.lastSyncedAt) : 'never'
  return `Last synced ${when} · ${s.breweryCount.toLocaleString()} breweries`
})

const ungeocodedCount = computed(() => {
  const count = syncStatus.value?.breweryCount ?? 0
  return points.value.length ? Math.max(0, count - points.value.length) : 0
})

async function onSync() {
  try {
    await queueSync()
    toast.add({ title: 'Brewery sync queued', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to queue brewery sync', color: 'error' })
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-5 p-6 sm:p-9">
    <UCard>
      <template #header>
        <div class="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 class="text-lg font-semibold">Breweries</h1>
            <p class="mt-0.5 text-sm text-muted">{{ statusLine }}</p>
          </div>
          <div class="flex gap-2 flex-wrap items-center">
            <UButtonGroup>
              <UButton
                label="List"
                icon="i-lucide-list"
                :variant="view === 'list' ? 'solid' : 'outline'"
                color="neutral"
                @click="view = 'list'"
              />
              <UButton
                label="Map"
                icon="i-lucide-map"
                :variant="view === 'map' ? 'solid' : 'outline'"
                color="neutral"
                @click="view = 'map'"
              />
            </UButtonGroup>
            <UButton
              v-if="canSync"
              label="Sync breweries"
              icon="i-lucide-refresh-cw"
              :disabled="inProgress"
              :loading="inProgress"
              @click="onSync"
            />
          </div>
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <div class="flex gap-2 flex-wrap items-center">
          <UInput
            v-model="searchText"
            placeholder="Search name…"
            icon="i-lucide-search"
            class="w-full sm:w-56"
          />
          <USelectMenu
            v-model="typeFilter"
            :items="typeItems"
            value-key="value"
            placeholder="Type"
            class="w-full sm:w-40"
          />
          <UInput
            v-model="stateFilter"
            placeholder="State"
            class="w-full sm:w-36"
          />
          <UInput
            v-model="countryFilter"
            placeholder="Country"
            class="w-full sm:w-36"
          />
          <USwitch
            v-model="geolocatedOnly"
            label="Geocoded only"
          />
          <UButton
            v-if="filtersActive"
            label="Clear"
            variant="ghost"
            color="neutral"
            @click="clearFilters"
          />
        </div>

        <BreweryListView
          v-if="view === 'list'"
          v-model:page="page"
          :breweries="breweries"
          :fetching="fetching"
          :page-size="options.itemLimit"
          :total="total"
        />
        <BreweryMapView
          v-else
          :points="points"
          :ungeocoded-count="ungeocodedCount"
          :fetching="pointsFetching"
        />
      </div>
    </UCard>
  </div>
</template>
