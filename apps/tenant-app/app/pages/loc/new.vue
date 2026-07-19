<script setup lang="ts">
import type { LocationInfoInput } from '@function-bucket/fnb-types'

const toast = useToast()

const { createLocation } = useLocations()

const form = reactive({
  name: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  lat: '',
  lon: '',
})
const submitting = ref(false)

async function submit() {
  submitting.value = true
  try {
    const info: Omit<LocationInfoInput, 'id'> = {
      name: form.name || null,
      address1: form.address1 || null,
      address2: form.address2 || null,
      city: form.city || null,
      state: form.state || null,
      postalCode: form.postalCode || null,
      country: form.country || null,
      lat: form.lat || null,
      lon: form.lon || null,
    }
    const location = await createLocation(info)
    if (location) {
      await navigateTo(`/loc/${location.id}`)
    } else {
      await navigateTo('/loc')
    }
  } catch {
    toast.add({ title: 'Failed to create location', color: 'error' })
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4 p-6 sm:p-9">
    <UButton
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      to="/loc"
      size="sm"
      class="-ml-2 text-muted"
    >
      Locations
    </UButton>

    <UCard>
      <template #header>
        <h1 class="text-lg font-semibold">
          New Location
        </h1>
      </template>

      <div class="flex flex-col gap-4">
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
            :loading="submitting"
            @click="submit"
          >
            Create Location
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
            to="/loc"
          >
            Cancel
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
