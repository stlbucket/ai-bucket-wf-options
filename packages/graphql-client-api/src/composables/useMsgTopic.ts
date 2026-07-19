import { ref, computed, onMounted, onUnmounted, toRef } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useDiscussionByIdQuery, useUpsertMessageMutation } from '../generated/fnb-graphql-api'

export type MsgMessage = {
  id: string
  topicId: string
  content: string
  createdAt: string
  status: string
  postedByResidentUrn: string
  senderDisplayName: string | null
}

export type MsgTopic = {
  id: string
  name: string
  identifier: string | null
  status: string
}

export function useMsgTopic(topicId: MaybeRefOrGetter<string>) {
  const id = toRef(topicId)

  const variables = computed(() => ({ topicId: id.value }))
  const { data, fetching, error } = useDiscussionByIdQuery({ variables })
  const { executeMutation: execSend } = useUpsertMessageMutation()

  const topic = computed<MsgTopic | null>(() => {
    const t = data.value?.topic
    if (!t) return null
    return {
      id: String(t.id),
      name: t.name,
      identifier: t.identifier ?? null,
      status: t.status,
    }
  })

  const sending = ref(false)

  // Ordered source of truth from the server query.
  const serverMessages = computed<MsgMessage[]>(() =>
    (data.value?.topic?.messages ?? [])
      .filter((m): m is NonNullable<typeof m> => m != null)
      .map((m) => ({
        id: String(m.id),
        topicId: m.topicId != null ? String(m.topicId) : id.value,
        content: m.content,
        createdAt: String(m.createdAt),
        status: m.status,
        postedByResidentUrn: String(m.postedByResidentUrn),
        senderDisplayName: m.postedBy?.resident?.displayName ?? null,
      })),
  )

  // Real-time arrivals fetched over HTTP after a WS notify. A message stays here only
  // until the next server refetch includes it, at which point the dedup below drops it.
  const liveMessages = ref<MsgMessage[]>([])

  // Merge server + live, dedup by id (server copy wins), sort ascending by createdAt.
  const messages = computed<MsgMessage[]>(() => {
    const byId = new Map<string, MsgMessage>()
    for (const m of liveMessages.value) byId.set(m.id, m)
    for (const m of serverMessages.value) byId.set(m.id, m)
    return [...byId.values()].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
  })

  // WebSocket: real-time push — ported from REST implementation
  // _ws route and pg-notify-bridge remain unchanged; only initial load uses GraphQL
  let ws: WebSocket | null = null

  function connect() {
    if (ws) {
      ws.onclose = null
      ws.close(1000)
      ws = null
    }
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${protocol}//${location.host}/msg/_ws/topics/${id.value}/messages`)

    ws.addEventListener('message', async (event) => {
      const n = JSON.parse(event.data) as { event: string; id: string }
      if (n.event === 'create') {
        if (liveMessages.value.some((m) => m.id === n.id)) return
        const msg = await fetch(`/msg/api/topics/${id.value}/messages/${n.id}`, {
          credentials: 'include',
        }).then((r) => r.json() as Promise<MsgMessage>)
        if (liveMessages.value.some((m) => m.id === msg.id)) return
        liveMessages.value.push(msg)
      }
    })

    ws.addEventListener('close', (e) => {
      if (e.code !== 1000) setTimeout(connect, 2000)
    })
  }

  onMounted(connect)
  onUnmounted(() => ws?.close(1000, 'unmounted'))

  async function sendMessage(content: string) {
    sending.value = true
    try {
      const result = await execSend({ messageInfo: { topicId: id.value, content } })
      if (result.error) throw result.error
    } finally {
      sending.value = false
    }
  }

  return { topic, messages, fetching, error, sending, sendMessage }
}
