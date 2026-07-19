import type { MessageWithSender } from '@function-bucket/fnb-types'
import type { MsgMessage, MsgTopic } from '@function-bucket/fnb-graphql-client-api'
import { useDiscussionByIdQuery } from '@function-bucket/fnb-graphql-client-api'

export function useTopicMessages(topicId: MaybeRef<string>) {
  const id = toRef(topicId)
  const messages = ref<MsgMessage[]>([])

  // Initial load: GraphQL (DiscussionById returns the topic + its messagesList)
  const variables = computed(() => ({ topicId: id.value }))
  const { data } = useDiscussionByIdQuery({ variables })

  const topic = computed<MsgTopic | null>(() => {
    const t = data.value?.topic
    if (!t) return null
    return { id: String(t.id), name: t.name, identifier: t.identifier ?? null, status: t.status }
  })

  watch(
    data,
    (val) => {
      const msgs = val?.topic?.messages
      if (!msgs) return
      messages.value = msgs
        .filter((m): m is NonNullable<typeof m> => m != null)
        .map((m) => ({
          id: String(m.id),
          topicId: m.topicId != null ? String(m.topicId) : id.value,
          content: m.content,
          createdAt: String(m.createdAt),
          status: m.status,
          postedByResidentUrn: m.postedBy?.residentId ? String(m.postedBy.residentId) : '', // remapped to resident urn after codegen (urn-registry Phase 6)
          senderDisplayName: m.postedBy?.displayName ?? null,
        }))
    },
    { immediate: true },
  )

  // Real-time push stays on the WebSocket + REST incremental fetch (not GraphQL).
  let ws: WebSocket | null = null

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${protocol}//${location.host}/_ws/topics/${id.value}/messages`)

    ws.addEventListener('message', async (event) => {
      const notification = JSON.parse(event.data) as { event: string; id: string }
      if (notification.event === 'create') {
        const m = await $fetch<MessageWithSender>(
          `/api/topics/${id.value}/messages/${notification.id}`,
        )
        messages.value.push({
          id: String(m.id),
          topicId: String(m.topicId),
          content: m.content,
          createdAt: String(m.createdAt),
          status: m.status,
          postedByResidentUrn: String(m.postedByResidentUrn),
          senderDisplayName: m.senderDisplayName ?? null,
        })
      }
    })

    ws.addEventListener('close', (e) => {
      if (e.code !== 1000) setTimeout(connect, 2000)
    })
  }

  onMounted(connect)
  onUnmounted(() => ws?.close(1000, 'unmounted'))

  return { topic, messages }
}
