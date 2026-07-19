<template>
  <UEmpty
    v-if="!applications.length"
    icon="i-lucide-layout-grid"
    label="No applications found."
  />
  <div
    v-else
    class="overflow-x-auto"
  >
    <UTable
      :data="applications"
      :columns="columns"
      class="grow"
    >
      <template #key-cell="{ row }">
        <NuxtLink
          :to="`/site-admin/application/${row.original.key}`"
          class="font-medium hover:underline font-mono"
        >
          {{ row.original.key }}
        </NuxtLink>
      </template>
    </UTable>
  </div>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type { Application } from '@function-bucket/fnb-types'

defineProps<{
  applications: Application[]
}>()

const columns: TableColumn<Application>[] = [
  { accessorKey: 'key', header: 'Key' },
  { accessorKey: 'name', header: 'Name' }
]
</script>
