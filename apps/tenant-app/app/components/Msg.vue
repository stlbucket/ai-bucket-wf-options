<script setup lang="ts">
import { parseUrn } from '@function-bucket/fnb-types'

const props = defineProps<{
  topicId: string
  currentResidentId?: string
  hideHeader?: boolean
}>()

const UCard = resolveComponent('UCard')

const topicIdRef = computed(() => props.topicId)
const { topic, messages, sending, sendMessage } = useMsgTopic(topicIdRef)

const threadEl = useTemplateRef<HTMLDivElement>('thread')
function scrollToBottom() {
  nextTick(() => {
    if (threadEl.value) threadEl.value.scrollTop = threadEl.value.scrollHeight
  })
}
watch(() => messages.value.length, scrollToBottom)
onMounted(scrollToBottom)

const content = ref('')
async function handleSend() {
  const trimmed = content.value.trim()
  if (!trimmed) return
  await sendMessage(trimmed)
  content.value = ''
}

// Raw hex required: per-participant distinct colors can't be served by the 7-token
// semantic palette. Each entry is a light/dark pair (Tailwind 50/700 equivalents) —
// bg tints the avatar, text colors its initials.
const PARTICIPANT_PAIRS = [
  { bg: '#eff6ff', text: '#1d4ed8' }, // blue
  { bg: '#ecfdf5', text: '#047857' }, // green
  { bg: '#f5f3ff', text: '#6d28d9' }, // purple
  { bg: '#fff7ed', text: '#c2410c' }, // orange
  { bg: '#fdf2f8', text: '#be185d' }, // pink
  { bg: '#f0fdfa', text: '#0f766e' }, // teal
  { bg: '#fefce8', text: '#a16207' }, // yellow
  { bg: '#fff1f2', text: '#be123c' } // rose
]

const participantColorMap = computed(() => {
  const map = new Map<string, number>()
  for (const msg of messages.value) {
    if (!map.has(msg.postedByResidentUrn)) {
      map.set(msg.postedByResidentUrn, map.size % PARTICIPANT_PAIRS.length)
    }
  }
  return map
})

function senderPair(msg: { postedByResidentUrn: string }) {
  const idx = participantColorMap.value.get(msg.postedByResidentUrn) ?? 0
  return PARTICIPANT_PAIRS[idx]!
}

function senderLabel(msg: { postedByResidentUrn: string, senderDisplayName: string | null }) {
  // currentResidentId is the claims uuid; the message carries the resident's urn
  const senderId = parseUrn(msg.postedByResidentUrn)?.id ?? msg.postedByResidentUrn
  if (props.currentResidentId && senderId === props.currentResidentId) return 'You'
  return msg.senderDisplayName ?? 'Unknown'
}

function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

// Compact relative time ("45m", "2h", "3d"), falling back to a date for older messages.
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString()
}

// Collapse consecutive messages from the same sender within ~5 min: omit avatar + meta.
const COLLAPSE_WINDOW_MS = 5 * 60 * 1000
const displayMessages = computed(() =>
  messages.value.map((msg, i) => {
    const prev = messages.value[i - 1]
    const collapsed
      = !!prev
        && prev.postedByResidentUrn === msg.postedByResidentUrn
        && new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < COLLAPSE_WINDOW_MS
    return { ...msg, showMeta: !collapsed }
  })
)
</script>

<template>
  <component
    :is="hideHeader ? 'div' : UCard"
    :ui="hideHeader ? undefined : { body: 'flex flex-1 flex-col min-h-0' }"
    :class="hideHeader ? 'flex flex-col min-h-0' : 'flex flex-col'"
  >
    <template
      v-if="!hideHeader"
      #header
    >
      <div class="text-base font-semibold">
        {{ topic?.name ?? 'Topic' }}
      </div>
    </template>

    <div
      ref="thread"
      class="flex flex-1 min-h-0 flex-col gap-2.5 overflow-y-auto"
    >
      <div
        v-for="msg in displayMessages"
        :key="msg.id"
        class="flex gap-2 pl-2"
        :style="{ borderLeftColor: senderPair(msg).text }"
      >
        <span
          v-if="msg.showMeta"
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
          :style="{ backgroundColor: senderPair(msg).bg, color: senderPair(msg).text }"
        >{{ initials(msg.senderDisplayName) }}</span>
        <span
          v-else
          class="w-6 shrink-0"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <div
            v-if="msg.showMeta"
            class="text-[11px] text-dimmed"
          >
            <span
              class="font-semibold"
              :style="{ color: senderPair(msg).text }"
            >{{ senderLabel(msg) }}</span>
            · {{ relativeTime(msg.createdAt) }}
          </div>
          <p class="text-[13px] leading-[1.45] text-default whitespace-pre-wrap">
            {{ msg.content }}
          </p>
        </div>
      </div>

      <div
        v-if="!messages.length && hideHeader"
        class="py-1 text-xs text-dimmed"
      >
        No discussion yet.
      </div>
      <UEmpty
        v-else-if="!messages.length"
        icon="i-lucide-message-square"
        label="No messages yet. Be the first to post!"
      />
    </div>

    <div class="mt-auto flex gap-1.5 pt-3">
      <UTextarea
        v-model="content"
        autoresize
        :rows="hideHeader ? 1 : 2"
        :maxrows="8"
        :placeholder="hideHeader ? 'Reply…' : 'Write a message…'"
        class="flex-1"
        @keydown.meta.enter="handleSend"
      />
      <UButton
        :icon="hideHeader ? 'i-lucide-send' : undefined"
        :label="hideHeader ? undefined : 'Send'"
        :loading="sending"
        :disabled="!content.trim()"
        class="self-end"
        @click="handleSend"
      />
    </div>
  </component>
</template>
