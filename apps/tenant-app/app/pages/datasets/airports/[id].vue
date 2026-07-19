<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AirportFrequency, Navaid, Runway } from '@function-bucket/fnb-types'

const route = useRoute()

const { airport, runways, frequencies, navaids, fetching, error } = useAirport(
  String(route.params.id),
)

const cityLine = computed(() => {
  const a = airport.value
  if (!a) return null
  return [a.location.city, a.isoRegion, a.isoCountry].filter(Boolean).join(', ') || null
})

const mapCoords = computed<[number, number] | null>(() => {
  const loc = airport.value?.location
  if (!loc?.lat || !loc?.lon) return null
  const lat = parseFloat(loc.lat)
  const lon = parseFloat(loc.lon)
  if (isNaN(lat) || isNaN(lon)) return null
  return [lon, lat]
})

const updatedAt = computed(() =>
  airport.value ? airport.value.updatedAt.toLocaleString() : null,
)

function runwayIdent(r: Runway): string {
  return [r.leIdent, r.heIdent].filter(Boolean).join('/') || '—'
}

const runwayColumns: TableColumn<Runway>[] = [
  { id: 'ident', header: 'Runway' },
  { id: 'length', header: 'Length (ft)' },
  { id: 'width', header: 'Width (ft)' },
  { accessorKey: 'surface', header: 'Surface' },
  { id: 'lighted', header: 'Lighted' },
  { id: 'closed', header: 'Closed' },
]

const frequencyColumns: TableColumn<AirportFrequency>[] = [
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'description', header: 'Description' },
  { id: 'mhz', header: 'MHz' },
]

const navaidColumns: TableColumn<Navaid>[] = [
  { accessorKey: 'ident', header: 'Ident' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'type', header: 'Type' },
  { id: 'khz', header: 'kHz' },
  { accessorKey: 'usageType', header: 'Usage' },
  { accessorKey: 'power', header: 'Power' },
]
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-5 p-6 sm:p-9">
    <div
      v-if="fetching"
      class="flex justify-center py-16"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-6 animate-spin text-muted"
      />
    </div>

    <UAlert
      v-else-if="!airport"
      color="warning"
      variant="subtle"
      icon="i-lucide-plane"
      title="Airport not found"
      :description="error ? 'Something went wrong loading this airport.' : 'This airport does not exist or is no longer available.'"
      :actions="[{ label: 'Back to airports', to: '/datasets/airports', color: 'neutral', variant: 'outline' }]"
    />

    <UCard v-else>
      <template #header>
        <div class="flex justify-between items-start gap-4 flex-wrap">
          <div class="flex items-center gap-3 flex-wrap">
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-arrow-left"
              to="/datasets/airports"
              size="sm"
            />
            <h1 class="text-lg font-semibold">{{ airport.name }}</h1>
            <span class="font-mono text-sm text-muted">{{ airport.ident }}</span>
            <UBadge
              :color="airportTypeColor(airport.type)"
              variant="subtle"
            >
              {{ airportTypeLabel(airport.type) }}
            </UBadge>
            <UBadge
              v-if="airport.scheduledService"
              color="success"
              variant="subtle"
            >
              Scheduled service
            </UBadge>
          </div>
          <div class="flex gap-2 flex-wrap">
            <UButton
              v-if="airport.homeLink"
              label="Website"
              icon="i-lucide-external-link"
              variant="outline"
              color="neutral"
              :to="airport.homeLink"
              target="_blank"
            />
            <UButton
              v-if="airport.wikipediaLink"
              label="Wikipedia"
              icon="i-lucide-external-link"
              variant="ghost"
              color="neutral"
              :to="airport.wikipediaLink"
              target="_blank"
            />
          </div>
        </div>
      </template>

      <div class="flex flex-col gap-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 class="text-sm font-medium text-muted mb-2">Location</h2>
            <div class="text-sm space-y-0.5">
              <p v-if="cityLine">{{ cityLine }}</p>
              <p>Continent: {{ airport.continent }}</p>
              <p v-if="airport.elevationFt != null">Elevation: {{ airport.elevationFt.toLocaleString() }} ft MSL</p>
              <p v-if="airport.location.lat && airport.location.lon" class="font-mono text-xs text-muted">
                {{ airport.location.lat }}, {{ airport.location.lon }}
              </p>
            </div>
          </div>

          <div>
            <h2 class="text-sm font-medium text-muted mb-2">Codes</h2>
            <div class="text-sm space-y-0.5 font-mono">
              <p>ICAO: {{ airport.icaoCode ?? '—' }}</p>
              <p>IATA: {{ airport.iataCode ?? '—' }}</p>
              <p>GPS: {{ airport.gpsCode ?? '—' }}</p>
              <p>Local: {{ airport.localCode ?? '—' }}</p>
            </div>
          </div>

          <div class="md:col-span-2">
            <h2 class="text-sm font-medium text-muted mb-2">Meta</h2>
            <div class="text-xs text-muted space-y-0.5">
              <p>OurAirports id: {{ airport.externalId }}</p>
              <p v-if="airport.keywords">Keywords: {{ airport.keywords }}</p>
              <p>Last updated: {{ updatedAt }}</p>
              <p v-if="airport.notes">Notes: {{ airport.notes }}</p>
            </div>
          </div>
        </div>

        <div v-if="runways.length">
          <h2 class="text-sm font-medium text-muted mb-2">Runways ({{ runways.length }})</h2>
          <div class="overflow-x-auto">
            <UTable
              :data="runways"
              :columns="runwayColumns"
            >
              <template #ident-cell="{ row }">
                <span class="font-mono">{{ runwayIdent(row.original) }}</span>
              </template>
              <template #length-cell="{ row }">
                {{ row.original.lengthFt?.toLocaleString() ?? '—' }}
              </template>
              <template #width-cell="{ row }">
                {{ row.original.widthFt?.toLocaleString() ?? '—' }}
              </template>
              <template #lighted-cell="{ row }">
                <UIcon
                  v-if="row.original.lighted"
                  name="i-lucide-check"
                  class="text-success"
                />
                <span v-else class="text-muted">—</span>
              </template>
              <template #closed-cell="{ row }">
                <UBadge
                  v-if="row.original.closed"
                  color="error"
                  variant="subtle"
                >
                  Closed
                </UBadge>
                <span v-else class="text-muted">—</span>
              </template>
            </UTable>
          </div>
        </div>

        <div v-if="frequencies.length">
          <h2 class="text-sm font-medium text-muted mb-2">Frequencies ({{ frequencies.length }})</h2>
          <div class="overflow-x-auto">
            <UTable
              :data="frequencies"
              :columns="frequencyColumns"
            >
              <template #mhz-cell="{ row }">
                {{ row.original.frequencyMhz ?? '—' }}
              </template>
            </UTable>
          </div>
        </div>

        <div v-if="navaids.length">
          <h2 class="text-sm font-medium text-muted mb-2">Navaids ({{ navaids.length }})</h2>
          <div class="overflow-x-auto">
            <UTable
              :data="navaids"
              :columns="navaidColumns"
            >
              <template #type-cell="{ row }">
                <UBadge color="neutral" variant="subtle">{{ row.original.type }}</UBadge>
              </template>
              <template #khz-cell="{ row }">
                {{ row.original.frequencyKhz ?? '—' }}
              </template>
            </UTable>
          </div>
        </div>
      </div>

      <template
        v-if="mapCoords"
        #footer
      >
        <div class="h-64 rounded-lg overflow-hidden">
          <MapboxMap
            :map-id="`airport-${airport.id}`"
            class="w-full h-full"
            :options="{
              style: 'mapbox://styles/mapbox/streets-v12',
              center: mapCoords,
              zoom: 11,
              cooperativeGestures: true,
            }"
          >
            <MapboxDefaultMarker
              :marker-id="`airport-marker-${airport.id}`"
              :lnglat="mapCoords"
            />
          </MapboxMap>
        </div>
      </template>
    </UCard>
  </div>
</template>
