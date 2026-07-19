<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Airport } from '@function-bucket/fnb-types'

defineProps<{
  airports: Airport[]
  fetching: boolean
  page: number
  pageSize: number
  total: number
}>()

defineEmits<{ (e: 'update:page', page: number): void }>()

const columns: TableColumn<Airport>[] = [
  { accessorKey: 'ident', header: 'Ident' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'type', header: 'Type' },
  { id: 'iata', header: 'IATA' },
  { id: 'municipality', header: 'Municipality' },
  { id: 'region', header: 'Region' },
  { id: 'country', header: 'Country' },
  { id: 'scheduled', header: 'Scheduled' },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="overflow-x-auto">
      <UTable
        :data="airports"
        :columns="columns"
        :loading="fetching"
      >
        <template #ident-cell="{ row }">
          <NuxtLink
            :to="`/datasets/airports/${row.original.id}`"
            class="font-mono text-sm hover:underline"
          >
            {{ row.original.ident }}
          </NuxtLink>
        </template>
        <template #name-cell="{ row }">
          <NuxtLink
            :to="`/datasets/airports/${row.original.id}`"
            class="font-medium hover:underline"
          >
            {{ row.original.name }}
          </NuxtLink>
        </template>
        <template #type-cell="{ row }">
          <UBadge
            :color="airportTypeColor(row.original.type)"
            variant="subtle"
          >
            {{ airportTypeLabel(row.original.type) }}
          </UBadge>
        </template>
        <template #iata-cell="{ row }">
          <span class="font-mono text-sm">{{ row.original.iataCode ?? '—' }}</span>
        </template>
        <template #municipality-cell="{ row }">
          {{ row.original.location.city ?? '—' }}
        </template>
        <template #region-cell="{ row }">
          {{ row.original.isoRegion }}
        </template>
        <template #country-cell="{ row }">
          {{ row.original.isoCountry }}
        </template>
        <template #scheduled-cell="{ row }">
          <UBadge
            v-if="row.original.scheduledService"
            color="success"
            variant="subtle"
          >
            Scheduled
          </UBadge>
          <span v-else class="text-muted">—</span>
        </template>
        <template #empty>
          <span class="text-sm text-muted">No airports match the current filters.</span>
        </template>
      </UTable>
    </div>

    <div class="flex justify-end">
      <UPagination
        :page="page"
        :items-per-page="pageSize"
        :total="total"
        @update:page="$emit('update:page', $event)"
      />
    </div>
  </div>
</template>
