<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Asset, ScanStatus } from '@function-bucket/fnb-types'
import { parseUrn } from '@function-bucket/fnb-types'

// Presentational only — no data fetching (R2). Reused by the site-admin assets page (all assets)
// and later by todo / support-ticket detail pages (that entity's assets). Colors come from the
// shared status vocabulary (statusColor, UC1); subject + scan labels are asset-specific.
const props = withDefaults(
  defineProps<{
    assets: Asset[]
    showTenant?: boolean
    showSubject?: boolean
    linkDetail?: boolean
  }>(),
  { showTenant: false, showSubject: true, linkDetail: true }
)

// Subject badge — the stacked-on business object's type, parsed from the subject URN
// (urn-registry stacking v2); '—' for unattached uploads.
function subjectLabel(subjectUrn: string | null): string {
  if (!subjectUrn) return '—'
  const parsed = parseUrn(subjectUrn)
  return parsed ? `${parsed.module}/${parsed.resourceType}` : '—'
}

// Scan status uses the shared color map (statusColor('asset', …)) but asset-specific wording.
const scanLabel: Record<ScanStatus, string> = {
  PENDING: 'Malware scan pending…',
  CLEAN: 'Clean',
  INFECTED: 'Infected',
  ERROR: 'Scan error'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let size = bytes / 1024
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

const columns = computed<TableColumn<Asset>[]>(() => [
  ...(props.showTenant ? [{ accessorKey: 'tenantName', header: 'Tenant' } as TableColumn<Asset>] : []),
  { accessorKey: 'originalName', header: 'Name' },
  ...(props.showSubject ? [{ accessorKey: 'subjectUrn', header: 'Subject' } as TableColumn<Asset>] : []),
  { accessorKey: 'contentType', header: 'Type' },
  { accessorKey: 'sizeBytes', header: 'Size' },
  { accessorKey: 'tags', header: 'Tags' },
  { accessorKey: 'isPublic', header: 'Visibility' },
  { accessorKey: 'scanStatus', header: 'Scan' },
  { accessorKey: 'createdAt', header: 'Uploaded' },
  { id: 'actions' }
])
</script>

<template>
  <UEmpty
    v-if="!assets.length"
    icon="i-lucide-folder-open"
    label="No assets"
  />
  <div
    v-else
    class="overflow-x-auto"
  >
    <UTable
      :data="assets"
      :columns="columns"
      class="grow"
    >
      <template #tenantName-cell="{ row }">
        <span class="text-sm text-muted">{{ row.original.tenantName ?? '—' }}</span>
      </template>

      <template #originalName-cell="{ row }">
        <ULink
          v-if="props.linkDetail"
          :to="`/assets/${row.original.id}`"
          class="font-medium text-primary"
        >
          {{ row.original.originalName }}
        </ULink>
        <span v-else class="font-medium">{{ row.original.originalName }}</span>
      </template>

      <template #subjectUrn-cell="{ row }">
        <UBadge
          :color="row.original.subjectUrn ? 'primary' : 'neutral'"
          variant="subtle"
          size="sm"
        >
          {{ subjectLabel(row.original.subjectUrn) }}
        </UBadge>
      </template>

      <template #contentType-cell="{ row }">
        <span class="text-sm text-muted">{{ row.original.contentType }}</span>
      </template>

      <template #sizeBytes-cell="{ row }">
        <span class="text-sm text-muted">{{ formatSize(row.original.sizeBytes) }}</span>
      </template>

      <template #tags-cell="{ row }">
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="tag in row.original.tags"
            :key="tag"
            color="neutral"
            variant="subtle"
            size="sm"
          >
            {{ tag }}
          </UBadge>
        </div>
      </template>

      <template #isPublic-cell="{ row }">
        <UBadge
          :color="row.original.isPublic ? 'warning' : 'neutral'"
          variant="subtle"
          size="sm"
        >
          {{ row.original.isPublic ? 'Public' : 'Private' }}
        </UBadge>
      </template>

      <template #scanStatus-cell="{ row }">
        <UBadge
          :color="statusColor('asset', row.original.scanStatus)"
          variant="subtle"
          size="sm"
        >
          {{ scanLabel[row.original.scanStatus] }}
        </UBadge>
      </template>

      <template #createdAt-cell="{ row }">
        <span class="text-sm text-muted">{{ new Date(row.original.createdAt).toLocaleDateString() }}</span>
      </template>

      <template #actions-cell="{ row }">
        <UButton
          v-if="row.original.downloadUrl"
          icon="i-lucide-download"
          variant="ghost"
          color="neutral"
          size="sm"
          :to="row.original.downloadUrl"
          target="_blank"
        />
      </template>
    </UTable>
  </div>
</template>
