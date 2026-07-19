<script lang="ts" setup>
// Shared attachments UI — file rows + drop zone, or an empty state.
// The section header (label / count / Upload link) is rendered by the caller,
// so this stays reusable across the ticket rail and the todo detail rail.
export type AttachmentKind = 'image' | 'pdf' | 'audio' | 'other'

export type AttachmentFile = {
  name: string
  size: string
  by: string
  kind: AttachmentKind
}

defineProps<{ files: AttachmentFile[] }>()

// Colour by kind; the chip label is the real file extension so it reads true.
const kindClasses: Record<AttachmentKind, string> = {
  image: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  pdf: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  audio: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  other: 'bg-elevated text-muted',
}

function chipLabel(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop() ?? '' : ''
  return (ext || 'file').slice(0, 4).toUpperCase()
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <template v-if="files.length">
      <div class="flex flex-col gap-1.5">
        <div
          v-for="file in files"
          :key="file.name"
          class="flex items-center gap-2.5 rounded-lg border border-default bg-default px-2.5 py-[7px]"
        >
          <div
            class="flex size-[30px] shrink-0 items-center justify-center rounded-md text-[9px] font-bold"
            :class="kindClasses[file.kind]"
          >
            {{ chipLabel(file.name) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs font-medium text-highlighted">{{ file.name }}</div>
            <div class="text-[10px] text-muted">{{ file.size }} · {{ file.by }}</div>
          </div>
        </div>
      </div>

      <div class="flex flex-col items-center gap-1 rounded-[10px] border-2 border-dashed border-default p-4 text-center">
        <span class="text-xs font-medium text-muted">Drop files to upload</span>
        <span class="text-[10px] text-dimmed">Photos, PDFs · up to 25 MB</span>
      </div>
    </template>

    <div
      v-else
      class="flex flex-col items-center gap-1 rounded-[10px] border-2 border-dashed border-default px-4 py-[22px] text-center"
    >
      <span class="text-xs font-medium text-muted">No attachments yet</span>
      <span class="text-[10px] text-dimmed">Drop files here or click Upload</span>
    </div>
  </div>
</template>
