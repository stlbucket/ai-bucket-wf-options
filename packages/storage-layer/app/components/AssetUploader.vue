<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AssetMeta } from '@function-bucket/fnb-types'

// Uploads a single file, optionally attached to a subject (URN stacking). Owns its POST — the documented exception to
// R2 (like Msg.vue owns its socket): upload is an imperative multipart action, not prop-driven
// rendering. The endpoint responds 202 Accepted with a PENDING AssetMeta (quarantine-first);
// the host page's list refresh() reveals the scan verdict later. (components.ui.md)
//
// Staged flow (v2): select a file → set options (public / tags / AI tags) → explicit Upload button.
// v1 uploaded the instant a file was selected; that gave no moment to set per-file options.

// Whitelist mirrors the endpoint's ALLOWED_TYPES (endpoint.data.md); the endpoint re-validates (415).
const DEFAULT_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.pdf,.docx,.xlsx,.csv,.txt'

// Image types eligible for AI tagging — mirrors the endpoint's IMAGE_TYPES; the endpoint 400s a
// hand-rolled aiTagsRequested on a non-image.
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

const props = withDefaults(
  defineProps<{
    subjectUrn?: string | null
    allowPublic?: boolean
    accept?: string
    disabled?: boolean
  }>(),
  { subjectUrn: null, allowPublic: true, accept: DEFAULT_ACCEPT, disabled: false }
)

const emit = defineEmits<{
  (e: 'uploaded', asset: AssetMeta): void
  (e: 'error', err: unknown): void
}>()

const { upload, uploading } = useAssetUpload()
const toast = useToast()

const file = ref<File | null>(null)
const isPublic = ref(false)
const tagsInput = ref('')
const aiTagsRequested = ref(false)

const isImage = computed(() => !!file.value && IMAGE_TYPES.has(file.value.type))

// Reset the AI-tags flag whenever a non-image is selected (the checkbox is disabled for non-images).
watch(file, () => {
  if (!isImage.value) aiTagsRequested.value = false
})

// Client-side normalization mirrors the endpoint (courtesy — the endpoint is authoritative):
// split on ',', trim, drop empties, dedupe case-insensitively.
function normalizeTags(raw: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const part of raw.split(',')) {
    const tag = part.trim()
    if (!tag) continue
    const lower = tag.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    out.push(tag)
  }
  return out
}

function reset() {
  file.value = null
  isPublic.value = false
  tagsInput.value = ''
  aiTagsRequested.value = false
}

function clearFile() {
  reset()
}

async function submit() {
  if (!file.value) return
  const selected = file.value
  try {
    const meta = await upload(
      selected,
      props.subjectUrn,
      isPublic.value,
      normalizeTags(tagsInput.value),
      aiTagsRequested.value
    )
    toast.add({ title: 'Upload accepted — scanning…', color: 'success' })
    emit('uploaded', meta)
  }
  catch (err) {
    toast.add({ title: 'Upload failed', color: 'error' })
    emit('error', err)
  }
  finally {
    reset() // clear the staged file + all options so the same file can be re-selected
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <UFileUpload
      v-model="file"
      :accept="accept"
      :disabled="disabled || uploading"
      variant="button"
      color="primary"
      icon="i-lucide-upload"
      label="Choose file"
      class="w-full sm:w-auto"
    />

    <div v-if="file" class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-1">
        <span class="text-sm text-muted truncate max-w-xs">{{ file.name }}</span>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="uploading"
          aria-label="Remove file"
          @click="clearFile"
        />
      </div>

      <USwitch
        v-if="allowPublic"
        v-model="isPublic"
        :disabled="disabled || uploading"
        label="Make public"
      />

      <UInput
        v-model="tagsInput"
        :disabled="disabled || uploading"
        placeholder="Tags, comma-separated"
        class="w-full sm:w-64"
      />

      <UCheckbox
        v-model="aiTagsRequested"
        :disabled="disabled || uploading || !isImage"
        label="Generate AI tags"
        description="Coming soon — your request will be noted on the asset."
      />

      <UButton
        color="primary"
        icon="i-lucide-upload"
        :loading="uploading"
        :disabled="disabled"
        @click="submit"
      >
        Upload
      </UButton>
    </div>
  </div>
</template>
