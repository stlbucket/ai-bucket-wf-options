<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Brewery } from '@function-bucket/fnb-types'

defineProps<{
  breweries: Brewery[]
  fetching: boolean
  page: number
  pageSize: number
  total: number
}>()

defineEmits<{ (e: 'update:page', page: number): void }>()

const columns: TableColumn<Brewery>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'breweryType', header: 'Type' },
  { id: 'city', header: 'City' },
  { id: 'state', header: 'State' },
  { id: 'country', header: 'Country' },
  { id: 'website' },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="overflow-x-auto">
      <UTable
        :data="breweries"
        :columns="columns"
        :loading="fetching"
      >
        <template #name-cell="{ row }">
          <NuxtLink
            :to="`/datasets/breweries/${row.original.id}`"
            class="font-medium hover:underline"
          >
            {{ row.original.name }}
          </NuxtLink>
        </template>
        <template #breweryType-cell="{ row }">
          <UBadge
            :color="breweryTypeColor(row.original.breweryType)"
            variant="subtle"
          >
            {{ breweryTypeLabel(row.original.breweryType) }}
          </UBadge>
        </template>
        <template #city-cell="{ row }">
          {{ row.original.location.city ?? '—' }}
        </template>
        <template #state-cell="{ row }">
          {{ row.original.location.state ?? '—' }}
        </template>
        <template #country-cell="{ row }">
          {{ row.original.location.country ?? '—' }}
        </template>
        <template #website-cell="{ row }">
          <UButton
            v-if="row.original.websiteUrl"
            :to="row.original.websiteUrl"
            target="_blank"
            icon="i-lucide-external-link"
            size="xs"
            variant="ghost"
            color="neutral"
          />
        </template>
        <template #empty>
          <span class="text-sm text-muted">No breweries match the current filters.</span>
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
