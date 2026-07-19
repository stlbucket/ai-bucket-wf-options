<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Location } from '@function-bucket/fnb-types'

const toast = useToast()

const { locations, fetching, deleteLocation } = useLocations()

async function handleDelete(id: string, name: string | null) {
  try {
    await deleteLocation(id)
    toast.add({ title: `${name ?? 'Location'} deleted`, color: 'success' })
  } catch {
    toast.add({ title: 'Failed to delete location', color: 'error' })
  }
}

const columns: TableColumn<Location>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'city', header: 'City' },
  { accessorKey: 'state', header: 'State' },
  { accessorKey: 'country', header: 'Country' },
  { id: 'actions' },
]
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Locations" :subtitle="`${locations.length} sites mapped`">
      <template #actions>
        <UButton
          icon="i-lucide-plus"
          color="secondary"
          to="/loc/new"
        >
          New Location
        </UButton>
      </template>
    </PageHeader>

    <div
      v-if="fetching"
      class="rounded-[10px] border border-default bg-default py-8 text-center text-sm text-muted"
    >
      Loading…
    </div>

    <UEmpty
      v-else-if="!locations.length"
      icon="i-lucide-map-pin"
      label="No locations yet. Add one to get started."
    />

    <div
      v-else
      class="overflow-hidden rounded-[10px] border border-default bg-default"
    >
      <UTable
        :data="locations"
        :columns="columns"
      >
          <template #name-cell="{ row }">
            <NuxtLink
              :to="`/loc/${row.original.id}`"
              class="font-medium hover:underline"
            >
              {{ row.original.name ?? '—' }}
            </NuxtLink>
          </template>
          <template #city-cell="{ row }">
            {{ row.original.city ?? '—' }}
          </template>
          <template #state-cell="{ row }">
            {{ row.original.state ?? '—' }}
          </template>
          <template #country-cell="{ row }">
            {{ row.original.country ?? '—' }}
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end">
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                variant="ghost"
                color="error"
                @click="handleDelete(String(row.original.id), row.original.name ?? null)"
              />
            </div>
          </template>
        </UTable>
      </div>
  </div>
</template>
