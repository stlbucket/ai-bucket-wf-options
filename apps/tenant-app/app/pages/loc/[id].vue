<script setup lang="ts">
import type { LocationInfoInput, Location } from '@function-bucket/fnb-types'

const route = useRoute()
const toast = useToast()

const { location, fetching, updateLocation, deleteLocation } = useLocation(String(route.params.id))

const locDisplay = computed(() => location.value as unknown as Location | null)

const editing = ref(false)

const form = reactive({
  name: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  lat: '',
  lon: ''
})

function openEdit() {
  if (!location.value) return
  form.name = location.value.name ?? ''
  form.address1 = location.value.address1 ?? ''
  form.address2 = location.value.address2 ?? ''
  form.city = location.value.city ?? ''
  form.state = location.value.state ?? ''
  form.postalCode = location.value.postalCode ?? ''
  form.country = location.value.country ?? ''
  form.lat = location.value.lat ?? ''
  form.lon = location.value.lon ?? ''
  editing.value = true
}

const mapCoords = computed<[number, number] | null>(() => {
  if (!location.value?.lat || !location.value?.lon) return null
  const lat = parseFloat(location.value.lat)
  const lon = parseFloat(location.value.lon)
  if (isNaN(lat) || isNaN(lon)) return null
  return [lon, lat]
})

const saving = ref(false)

async function save() {
  if (!location.value) return
  saving.value = true
  try {
    const fields: Omit<LocationInfoInput, 'id'> = {
      name: form.name || null,
      address1: form.address1 || null,
      address2: form.address2 || null,
      city: form.city || null,
      state: form.state || null,
      postalCode: form.postalCode || null,
      country: form.country || null,
      lat: form.lat || null,
      lon: form.lon || null
    }
    await updateLocation(fields)
    editing.value = false
    toast.add({ title: 'Location saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save location', color: 'error' })
  } finally {
    saving.value = false
  }
}

const deleting = ref(false)

async function handleDelete() {
  if (!location.value) return
  deleting.value = true
  try {
    await deleteLocation()
    toast.add({ title: 'Location deleted', color: 'success' })
    await navigateTo('/loc')
  } catch {
    toast.add({ title: 'Failed to delete location', color: 'error' })
    deleting.value = false
  }
}
</script>

<template>
  <div
    v-if="!fetching && location"
    class="flex flex-col gap-4 max-w-3xl mx-auto"
  >
    <div class="flex items-center gap-2">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        to="/loc"
        size="sm"
      >
        Locations
      </UButton>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <h1 class="text-lg font-semibold">
            {{ location.name ?? 'Location' }}
          </h1>
          <div class="flex gap-2">
            <UButton
              v-if="!editing"
              size="sm"
              variant="outline"
              color="neutral"
              icon="i-lucide-pencil"
              @click="openEdit"
            >
              Edit
            </UButton>
            <UButton
              size="sm"
              variant="outline"
              color="error"
              icon="i-lucide-trash-2"
              :loading="deleting"
              @click="handleDelete"
            >
              Delete
            </UButton>
          </div>
        </div>
      </template>

      <div v-if="!editing">
        <Loc
          v-if="locDisplay"
          :location="locDisplay"
        />
      </div>

      <div
        v-else
        class="flex flex-col gap-4"
      >
        <UFormField label="Name">
          <UInput
            v-model="form.name"
            placeholder="Location name"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Address line 1">
          <UInput
            v-model="form.address1"
            placeholder="Street address"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Address line 2">
          <UInput
            v-model="form.address2"
            placeholder="Suite, unit, etc."
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField
            label="City"
            class="sm:col-span-1"
          >
            <UInput
              v-model="form.city"
              placeholder="City"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="State"
            class="sm:col-span-1"
          >
            <UInput
              v-model="form.state"
              placeholder="State"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Postal code"
            class="sm:col-span-1"
          >
            <UInput
              v-model="form.postalCode"
              placeholder="Postal code"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Country">
          <UInput
            v-model="form.country"
            placeholder="Country"
            class="w-full"
          />
        </UFormField>

        <USeparator />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Latitude">
            <UInput
              v-model="form.lat"
              placeholder="e.g. 37.7749"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Longitude">
            <UInput
              v-model="form.lon"
              placeholder="e.g. -122.4194"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="flex gap-3">
          <UButton
            :loading="saving"
            @click="save"
          >
            Save
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
            @click="editing = false"
          >
            Cancel
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard v-if="mapCoords">
      <template #header>
        <h2 class="text-sm font-medium text-muted">
          Map
        </h2>
      </template>
      <div class="h-96 rounded-lg overflow-hidden">
        <MapboxMap
          :map-id="`loc-${location.id}`"
          class="w-full h-full"
          :options="{
            style: 'mapbox://styles/mapbox/streets-v12',
            center: mapCoords,
            zoom: 14
          }"
        >
          <MapboxDefaultMarker
            :marker-id="`loc-marker-${location.id}`"
            :lnglat="mapCoords"
          />
        </MapboxMap>
      </div>
    </UCard>
  </div>

  <div
    v-else-if="!fetching"
    class="text-sm text-muted"
  >
    Location not found.
  </div>
</template>
