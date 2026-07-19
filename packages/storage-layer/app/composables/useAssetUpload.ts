import { ref } from 'vue'
import type { AssetMeta } from '@function-bucket/fnb-types'

// Upload is REST (multipart can't ride GraphQL) — the layer-local carve-out consumed by
// AssetUploader. The endpoint responds 202 Accepted with a PENDING AssetMeta; the asset-scan
// workflow writes the terminal verdict later, observed via useSiteAssets().refresh().
// (asset-storage: assets-page.data.md, endpoint.data.md)

function messageForStatus(statusCode?: number, _data?: unknown): string {
  switch (statusCode) {
    case 400:
      return 'Invalid upload (check fields and tags)'
    case 413:
      return 'File too large (max 5 MB)'
    case 415:
      return 'File type not allowed'
    case 401:
      return 'Please sign in again'
    default:
      return 'Upload failed'
  }
}

export function useAssetUpload() {
  const uploading = ref(false)
  const error = ref<string | null>(null)
  const url = `${useRuntimeConfig().public.uploadUrl}`

  async function upload(
    file: File,
    subjectUrn: string | null,
    isPublic = false,
    tags: string[] = [],
    aiTagsRequested = false,
  ): Promise<AssetMeta> {
    uploading.value = true
    error.value = null
    try {
      const form = new FormData()
      form.append('file', file)
      if (subjectUrn) form.append('subjectUrn', subjectUrn) // stacking: the business object the upload attaches to
      if (isPublic) form.append('isPublic', 'true')
      if (tags.length) form.append('tags', tags.join(',')) // pre-normalized by AssetUploader; endpoint re-normalizes
      if (aiTagsRequested) form.append('aiTagsRequested', 'true') // images only (endpoint 400s otherwise)
      // Do NOT set Content-Type — the browser sets the multipart boundary. Same-origin (nginx),
      // so the httpOnly session cookie is sent automatically (Q5).
      return await $fetch<AssetMeta>(url, { method: 'POST', body: form })
    }
    catch (e: any) {
      error.value = messageForStatus(e?.statusCode, e?.data)
      throw e
    }
    finally {
      uploading.value = false
    }
  }

  return { upload, uploading, error }
}
