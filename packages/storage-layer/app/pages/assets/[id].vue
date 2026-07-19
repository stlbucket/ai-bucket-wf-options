<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseUrn } from '@function-bucket/fnb-types'

// Asset detail — all metadata + image preview, derived-children gallery, workflow deep-link, and
// a confirmed soft-delete (asset-storage: asset-detail.ui.md / asset-detail.data.md). Page calls
// composables only (R1); the delete $fetch is owned by useAssetDelete, not a child component (R2).
const route = useRoute()
const { user } = useAuth()
const toast = useToast()

const { asset, children, fetching, error, refresh } = useAssetDetail(route.params.id as string)
const { remove, deleting } = useAssetDelete()

const isSuperAdmin = computed(() => user.value?.permissions?.includes('p:app-admin-super') ?? false)
// UI hint only — the server (RLS in storage_api.delete_asset) is authoritative.
const canDelete = computed(
  () => isSuperAdmin.value || !!(asset.value && user.value?.permissions?.includes('p:app-user'))
)

const isImageType = (t?: string | null): boolean => !!t && t.startsWith('image/')
const isImage = computed(() => isImageType(asset.value?.contentType))

const scanColor = computed(() => statusColor('asset', asset.value?.scanStatus))
const scanLabel = computed(() => {
  switch (asset.value?.scanStatus) {
    case 'PENDING':
      return 'Malware scan pending…'
    case 'CLEAN':
      return 'Clean'
    case 'INFECTED':
      return 'Infected'
    case 'ERROR':
      return 'Scan error'
    default:
      return '—'
  }
})

// Subject = the stacked-on business object, parsed from the subject URN (stacking v2).
function subjectLabel(subjectUrn: string | null): string {
  if (!subjectUrn) return '—'
  const parsed = parseUrn(subjectUrn)
  return parsed ? `${parsed.module}/${parsed.resourceType}` : '—'
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

const fmtDate = (d?: Date | string | null): string => (d ? new Date(d).toLocaleString() : '—')

const confirmOpen = ref(false)

async function onDelete() {
  if (!asset.value) return
  try {
    await remove(asset.value.id)
    toast.add({ color: 'success', title: 'Asset deleted' })
    confirmOpen.value = false
    await navigateTo('/assets')
  } catch (e: any) {
    toast.add({ color: 'error', title: 'Delete failed', description: e?.data?.statusMessage })
    // leave the modal open so the user can retry
    void refresh()
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-5 p-6 sm:p-9">
    <PageHeader :title="asset?.originalName ?? 'Asset'" subtitle="Asset detail">
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            icon="i-lucide-arrow-left"
            variant="ghost"
            color="neutral"
            to="/assets"
            label="Back"
          />
          <UButton
            v-if="asset?.downloadUrl"
            icon="i-lucide-download"
            :to="asset.downloadUrl"
            target="_blank"
            label="Download"
          />
          <UButton
            v-if="canDelete"
            icon="i-lucide-trash-2"
            color="error"
            variant="soft"
            label="Delete"
            @click="confirmOpen = true"
          />
        </div>
      </template>
    </PageHeader>

    <div
      v-if="fetching"
      class="rounded-[10px] border border-default bg-default py-8 text-center text-sm text-muted"
    >
      Loading…
    </div>
    <UAlert
      v-else-if="error"
      color="error"
      icon="i-lucide-circle-alert"
      :title="error.message"
    />
    <UEmpty
      v-else-if="!asset"
      icon="i-lucide-file-question"
      label="Asset not found"
    />

    <template v-else>
      <div class="grid gap-5 lg:grid-cols-3">
        <!-- LEFT (2 cols): metadata definition list -->
        <UCard class="lg:col-span-2">
          <template #header>
            <h3 class="font-medium">Details</h3>
          </template>
          <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt class="text-sm text-muted">Uploaded by</dt>
              <dd>{{ asset.uploaderName ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Tenant</dt>
              <dd>{{ asset.tenantName ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Subject</dt>
              <dd>
                <UBadge :color="asset.subjectUrn ? 'primary' : 'neutral'" variant="subtle" size="sm">
                  {{ subjectLabel(asset.subjectUrn) }}
                </UBadge>
              </dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Subject URN</dt>
              <dd class="font-mono text-sm break-all">{{ asset.subjectUrn ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Visibility</dt>
              <dd>
                <UBadge :color="asset.isPublic ? 'warning' : 'neutral'" variant="subtle" size="sm">
                  {{ asset.isPublic ? 'Public' : 'Private' }}
                </UBadge>
              </dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Type</dt>
              <dd class="text-sm">{{ asset.contentType }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Size</dt>
              <dd class="text-sm">{{ formatSize(asset.sizeBytes) }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Extension</dt>
              <dd class="text-sm">{{ asset.extension }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-sm text-muted">Tags</dt>
              <dd>
                <div v-if="asset.tags.length" class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="tag in asset.tags"
                    :key="tag"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  >
                    {{ tag }}
                  </UBadge>
                </div>
                <span v-else>—</span>
              </dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Scan status</dt>
              <dd>
                <UBadge :color="scanColor" variant="subtle" size="sm">{{ scanLabel }}</UBadge>
              </dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Status</dt>
              <dd>
                <UBadge
                  :color="asset.assetStatus === 'ACTIVE' ? 'success' : 'neutral'"
                  variant="subtle"
                  size="sm"
                >
                  {{ asset.assetStatus === 'ACTIVE' ? 'Active' : 'Deleted' }}
                </UBadge>
              </dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Uploaded</dt>
              <dd class="text-sm">{{ fmtDate(asset.createdAt) }}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted">Updated</dt>
              <dd class="text-sm">{{ fmtDate(asset.updatedAt) }}</dd>
            </div>
          </dl>
        </UCard>

        <!-- RIGHT (1 col): preview + scan + workflow link -->
        <UCard>
          <template #header>
            <h3 class="font-medium">Preview &amp; processing</h3>
          </template>
          <img
            v-if="isImage && asset.downloadUrl"
            :src="asset.downloadUrl"
            class="mb-4 max-h-64 w-full rounded-md bg-elevated object-contain"
          />
          <UIcon v-else name="i-lucide-file" class="mb-4 size-16 text-dimmed" />

          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted">Scan</span>
              <UBadge :color="scanColor" variant="subtle">{{ scanLabel }}</UBadge>
            </div>
          </div>
        </UCard>
      </div>

      <!-- DERIVED CHILDREN (thumbnails) — the one place children surface -->
      <UCard v-if="children.length">
        <template #header>
          <h3 class="font-medium">
            Derived assets <span class="text-muted">({{ children.length }})</span>
          </h3>
        </template>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div
            v-for="c in children"
            :key="c.id"
            class="rounded-md border border-default p-2"
          >
            <img
              v-if="isImageType(c.contentType) && c.downloadUrl"
              :src="c.downloadUrl"
              class="mb-2 aspect-square w-full rounded bg-elevated object-cover"
            />
            <UIcon v-else name="i-lucide-image" class="mb-2 size-10 text-dimmed" />
            <div class="flex items-center justify-between gap-1">
              <UBadge variant="subtle" color="neutral" size="sm">
                {{ c.tags.includes('thumbnail') ? 'Thumbnail' : 'Derived' }}
              </UBadge>
              <UButton
                v-if="c.downloadUrl"
                icon="i-lucide-download"
                size="xs"
                variant="ghost"
                color="neutral"
                :to="c.downloadUrl"
                target="_blank"
              />
            </div>
          </div>
        </div>
      </UCard>
    </template>

    <!-- delete confirmation -->
    <UModal v-model:open="confirmOpen" title="Delete asset?">
      <template #body>
        <p>
          Delete <strong>{{ asset?.originalName }}</strong
          >?
        </p>
        <p v-if="children.length" class="mt-2 text-sm text-warning">
          This also removes {{ children.length }} derived asset(s) (thumbnail).
        </p>
        <p class="mt-2 text-sm text-muted">
          The stored file is permanently removed. This cannot be undone.
        </p>
      </template>
      <template #footer>
        <UButton variant="ghost" color="neutral" label="Cancel" @click="confirmOpen = false" />
        <UButton color="error" label="Delete" :loading="deleting" @click="onDelete" />
      </template>
    </UModal>
  </div>
</template>
