<script lang="ts" setup>
import type { Asset, AssetMeta, ScanStatus } from '@function-bucket/fnb-types'

// Real todo attachments (issue 0480) — compact rail rows, not the AssetList table (the rail is
// w-80). Props-only (R2): the page owns useSubjectAssets/useAssetDelete; AssetUploader owning its
// POST is the documented exception. Spec: tools/todo/[id].ui.md → Attachments.
const props = defineProps<{
  todoUrn: string
  assets: Asset[]
}>()

const emit = defineEmits<{
  (e: 'uploaded', asset: AssetMeta): void
  (e: 'delete-asset', assetId: string): void
}>()

const uploadOpen = ref(false)
const deleteTarget = ref<Asset | null>(null)

// Shared color map (statusColor('asset', …)) with asset-specific wording — same vocabulary as
// storage-layer's AssetList. PENDING is the normal state right after upload.
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

function handleUploaded(meta: AssetMeta) {
  uploadOpen.value = false
  emit('uploaded', meta)
}

function confirmDelete() {
  if (!deleteTarget.value) return
  emit('delete-asset', deleteTarget.value.id)
  deleteTarget.value = null
}
</script>

<template>
  <section>
    <div class="mb-2 flex items-center justify-between">
      <div class="text-[11px] font-semibold uppercase tracking-wider text-muted">
        Attachments · {{ props.assets.length }}
      </div>
      <UButton
        variant="link"
        color="primary"
        size="xs"
        :ui="{ base: 'p-0' }"
        @click="uploadOpen = true"
      >
        Upload
      </UButton>
    </div>

    <UEmpty
      v-if="!props.assets.length"
      icon="i-lucide-folder-open"
      label="No attachments"
    />

    <div
      v-else
      class="flex flex-col gap-2"
    >
      <div
        v-for="asset in props.assets"
        :key="asset.id"
        class="flex items-center gap-2.5 rounded-lg border border-default bg-default px-2.5 py-[7px]"
      >
        <UBadge
          color="neutral"
          variant="subtle"
          size="sm"
          class="shrink-0"
        >
          {{ asset.extension.toUpperCase() }}
        </UBadge>
        <div class="min-w-0 flex-1">
          <ULink
            :to="`/assets/${asset.id}`"
            class="block truncate text-xs font-medium text-primary"
          >
            {{ asset.originalName }}
          </ULink>
          <div class="flex items-center gap-1.5 text-[10px] text-muted">
            <span>{{ formatSize(asset.sizeBytes) }}</span>
            <span>·</span>
            <UBadge
              :color="statusColor('asset', asset.scanStatus)"
              variant="subtle"
              size="sm"
            >
              {{ scanLabel[asset.scanStatus] }}
            </UBadge>
          </div>
        </div>
        <UButton
          v-if="asset.downloadUrl"
          icon="i-lucide-download"
          variant="ghost"
          color="neutral"
          size="xs"
          :to="asset.downloadUrl"
          target="_blank"
          aria-label="Download"
        />
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          color="neutral"
          size="xs"
          aria-label="Delete attachment"
          @click="deleteTarget = asset"
        />
      </div>
    </div>

    <!-- Uploader modal — the staged flow doesn't fit the 320px rail inline -->
    <UModal v-model:open="uploadOpen">
      <template #header>
        <h3 class="text-base font-semibold">
          Upload Attachment
        </h3>
      </template>
      <template #body>
        <AssetUploader
          :subject-urn="props.todoUrn"
          :allow-public="false"
          @uploaded="handleUploaded"
        />
      </template>
    </UModal>

    <!-- Delete confirm modal — same confirm-then-emit pattern as todo delete -->
    <UModal
      :open="deleteTarget !== null"
      @update:open="(v: boolean) => { if (!v) deleteTarget = null }"
    >
      <template #header>
        <h3 class="text-base font-semibold">
          Delete Attachment
        </h3>
      </template>
      <template #body>
        <p class="text-sm">
          Are you sure you want to delete <strong>{{ deleteTarget?.originalName }}</strong>? This cannot be undone.
        </p>
      </template>
      <template #footer>
        <div class="flex gap-2">
          <UButton
            color="error"
            @click="confirmDelete"
          >
            Delete
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
            @click="deleteTarget = null"
          >
            Cancel
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
