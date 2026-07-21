import { ref } from 'vue'

// Delete is REST (side-effecting object-write carve-out, same posture as useAssetUpload — the
// GraphQL client never exposes storage_api). The endpoint soft-deletes the asset + its derived
// children and purges the MinIO objects, responding 200 { deleted: n }.
// (asset-storage: asset-detail.data.md, endpoint.data.md)

function messageForDeleteStatus(statusCode?: number): string {
  switch (statusCode) {
    case 403:
      return "You don't have permission to delete this asset"
    case 404:
      return 'Asset not found (already deleted?)'
    case 401:
      return 'Please sign in again'
    default:
      return 'Delete failed'
  }
}

export function useAssetDelete() {
  const deleting = ref(false)
  const error = ref<string | null>(null)
  // Derive the assets/[id] sibling from public.uploadUrl (.../storage/api/upload → .../storage/api).
  const base = `${useRuntimeConfig().public.uploadUrl}`.replace(/\/upload$/, '')

  async function remove(id: string) {
    deleting.value = true
    error.value = null
    try {
      // Same-origin through Caddy, so the httpOnly session cookie is sent automatically.
      return await $fetch<{ deleted: number }>(`${base}/assets/${id}`, { method: 'DELETE' })
    } catch (e: any) {
      error.value = messageForDeleteStatus(e?.statusCode)
      throw e
    } finally {
      deleting.value = false
    }
  }

  return { remove, deleting, error }
}
