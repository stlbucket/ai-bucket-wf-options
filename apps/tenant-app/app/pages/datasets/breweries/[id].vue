<script setup lang="ts">
const route = useRoute()

const { brewery, fetching, error } = useBrewery(String(route.params.id))

const cityLine = computed(() => {
  const loc = brewery.value?.location
  if (!loc) return null
  const left = [loc.city, loc.state].filter(Boolean).join(', ')
  const line = [left, loc.postalCode].filter(Boolean).join(' ')
  return line || null
})

const mapCoords = computed<[number, number] | null>(() => {
  const loc = brewery.value?.location
  if (!loc?.lat || !loc?.lon) return null
  const lat = parseFloat(loc.lat)
  const lon = parseFloat(loc.lon)
  if (isNaN(lat) || isNaN(lon)) return null
  return [lon, lat]
})

const updatedAt = computed(() =>
  brewery.value ? brewery.value.updatedAt.toLocaleString() : null,
)
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
      v-else-if="!brewery"
      color="warning"
      variant="subtle"
      icon="i-lucide-beer"
      title="Brewery not found"
      :description="error ? 'Something went wrong loading this brewery.' : 'This brewery does not exist or is no longer available.'"
      :actions="[{ label: 'Back to breweries', to: '/datasets/breweries', color: 'neutral', variant: 'outline' }]"
    />

    <UCard v-else>
      <template #header>
        <div class="flex justify-between items-start gap-4 flex-wrap">
          <div class="flex items-center gap-3 flex-wrap">
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-arrow-left"
              to="/datasets/breweries"
              size="sm"
            />
            <h1 class="text-lg font-semibold">{{ brewery.name }}</h1>
            <UBadge
              :color="breweryTypeColor(brewery.breweryType)"
              variant="subtle"
            >
              {{ breweryTypeLabel(brewery.breweryType) }}
            </UBadge>
          </div>
          <UButton
            v-if="brewery.websiteUrl"
            label="Website"
            icon="i-lucide-external-link"
            variant="outline"
            color="neutral"
            :to="brewery.websiteUrl"
            target="_blank"
          />
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 class="text-sm font-medium text-muted mb-2">Address</h2>
          <div class="text-sm space-y-0.5">
            <p v-if="brewery.location.address1">{{ brewery.location.address1 }}</p>
            <p v-if="brewery.location.address2">{{ brewery.location.address2 }}</p>
            <p v-if="cityLine">{{ cityLine }}</p>
            <p v-if="brewery.location.country">{{ brewery.location.country }}</p>
            <p
              v-if="!brewery.location.address1 && !cityLine && !brewery.location.country"
              class="text-muted"
            >
              No address on record
            </p>
          </div>
        </div>

        <div>
          <h2 class="text-sm font-medium text-muted mb-2">Contact</h2>
          <div class="text-sm space-y-0.5">
            <p v-if="brewery.phone">
              <a
                :href="`tel:${brewery.phone}`"
                class="hover:underline"
              >{{ brewery.phone }}</a>
            </p>
            <p v-if="brewery.websiteUrl">
              <a
                :href="brewery.websiteUrl"
                target="_blank"
                class="hover:underline break-all"
              >{{ brewery.websiteUrl }}</a>
            </p>
            <p
              v-if="!brewery.phone && !brewery.websiteUrl"
              class="text-muted"
            >
              No contact details
            </p>
          </div>
        </div>

        <div class="md:col-span-2">
          <h2 class="text-sm font-medium text-muted mb-2">Meta</h2>
          <div class="text-xs text-muted space-y-0.5">
            <p>Open Brewery DB id: {{ brewery.externalId }}</p>
            <p>Last updated: {{ updatedAt }}</p>
            <p v-if="brewery.notes">Notes: {{ brewery.notes }}</p>
          </div>
        </div>
      </div>

      <template
        v-if="mapCoords"
        #footer
      >
        <div class="h-64 rounded-lg overflow-hidden">
          <MapboxMap
            :map-id="`brewery-${brewery.id}`"
            class="w-full h-full"
            :options="{
              style: 'mapbox://styles/mapbox/streets-v12',
              center: mapCoords,
              zoom: 13,
              cooperativeGestures: true,
            }"
          >
            <MapboxDefaultMarker
              :marker-id="`brewery-marker-${brewery.id}`"
              :lnglat="mapCoords"
            />
          </MapboxMap>
        </div>
      </template>
    </UCard>
  </div>
</template>
