<script setup lang="ts">
import AirportListView from '~/components/datasets/AirportListView.vue'
import AirportMapView from '~/components/datasets/AirportMapView.vue'
import type { AirportType } from '@function-bucket/fnb-types'

const toast = useToast()
const { user } = useAuth()

const { airports, fetching, options, syncStatus, queueSync } = useAirports()
const { points, fetching: pointsFetching, includeClosed, activate } = useAirportMapPoints()

// default list; a page visit always starts on list
const view = ref<'list' | 'map'>('list')
watch(view, (v) => {
  if (v === 'map') activate()
})

const canSync = computed(() => user.value?.permissions?.includes('p:app-admin-super') ?? false)
const inProgress = computed(() => syncStatus.value?.inProgress ?? false)

// ---- filters (debounced ~300ms into the composable's reactive options; list only) ----
const searchText = ref('')
const typeFilter = ref<AirportType | undefined>(undefined)
const countryFilter = ref('')
const regionFilter = ref('')
const scheduledOnly = ref(false)

const typeItems = (
  [
    'LARGE_AIRPORT',
    'MEDIUM_AIRPORT',
    'SMALL_AIRPORT',
    'HELIPORT',
    'SEAPLANE_BASE',
    'BALLOONPORT',
    'CLOSED',
    'UNKNOWN',
  ] as AirportType[]
).map((value) => ({ label: airportTypeLabel(value), value }))

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch([searchText, typeFilter, countryFilter, regionFilter, scheduledOnly], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    options.value = {
      ...options.value,
      searchText: searchText.value || null,
      airportType: typeFilter.value ?? null,
      isoCountry: countryFilter.value || null,
      isoRegion: regionFilter.value || null,
      scheduledService: scheduledOnly.value ? true : null,
      pageOffset: 0,
    }
  }, 300)
})

const filtersActive = computed(
  () =>
    !!(searchText.value || typeFilter.value || countryFilter.value || regionFilter.value)
    || scheduledOnly.value,
)

function clearFilters() {
  searchText.value = ''
  typeFilter.value = undefined
  countryFilter.value = ''
  regionFilter.value = ''
  scheduledOnly.value = false
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
  if (!filtersActive.value) return syncStatus.value?.airportCount ?? airports.value.length
  const loaded = options.value.pageOffset * options.value.itemLimit + airports.value.length
  return airports.value.length === options.value.itemLimit
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
  if (!s || s.airportCount === 0) return 'No data yet — run a sync to load the dataset'
  const when = s.lastSyncedAt ? relativeTime(s.lastSyncedAt) : 'never'
  return `Last synced ${when} · ${s.airportCount.toLocaleString()} airports`
})

async function onSync() {
  try {
    await queueSync()
    toast.add({ title: 'Airport sync queued', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to queue airport sync', color: 'error' })
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-5 p-6 sm:p-9">
    <UCard>
      <template #header>
        <div class="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 class="text-lg font-semibold">Airports</h1>
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
              label="Sync airports"
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
            placeholder="Search name or code…"
            icon="i-lucide-search"
            class="w-full sm:w-56"
          />
          <USelectMenu
            v-model="typeFilter"
            :items="typeItems"
            value-key="value"
            placeholder="Type"
            class="w-full sm:w-44"
          />
          <UInput
            v-model="countryFilter"
            placeholder="Country (ISO2)"
            class="w-full sm:w-36"
          />
          <UInput
            v-model="regionFilter"
            placeholder="Region code"
            class="w-full sm:w-36"
          />
          <USwitch
            v-model="scheduledOnly"
            label="Scheduled service only"
          />
          <USwitch
            v-if="view === 'map'"
            v-model="includeClosed"
            label="Include closed on map"
          />
          <UButton
            v-if="filtersActive"
            label="Clear"
            variant="ghost"
            color="neutral"
            @click="clearFilters"
          />
        </div>

        <AirportListView
          v-if="view === 'list'"
          v-model:page="page"
          :airports="airports"
          :fetching="fetching"
          :page-size="options.itemLimit"
          :total="total"
        />
        <AirportMapView
          v-else
          :points="points"
          :fetching="pointsFetching"
        />
      </div>
    </UCard>
  </div>
</template>
