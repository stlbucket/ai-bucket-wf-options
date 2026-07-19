# WebSocket / Real-Time Pattern

Reference implementation: the `msg` module.
Use this as the template whenever a feature needs real-time push updates.

---

## Stack Overview

```
PostgreSQL trigger
  → pg_notify(channel, JSON payload)
        ↓
Nitro WebSocket handler  (server/routes/_ws/...)
  → pg LISTEN on channel
  → forwards notify payload to connected peer
        ↓
Client composable  (app/composables/use*.ts)
  → initial HTTP fetch for existing data
  → WebSocket connection for real-time updates
  → on notify: fetch full record via HTTP (do not trust payload as complete data)
  → reconnect with exponential backoff
        ↓
Vue component
  → uses composable, renders reactive data
  → no WebSocket or fetch logic inside the component
```

---

## Layer 1: PostgreSQL Trigger

The trigger fires after INSERT (or UPDATE) and publishes a minimal notify payload —
just enough to identify the record. The client then fetches the full record via HTTP.

```sql
-- Example: new message trigger on msg.message
create or replace function msg_fn.tg__on_message_insert()
returns trigger language plpgsql as $$
begin
  perform pg_notify(
    'topic:' || NEW.topic_id::text || ':message',
    json_build_object('event', 'create', 'id', NEW.id)::text
  );
  return NEW;
end;
$$;

create trigger tg__topic_subscription
  after insert on msg.message
  for each row execute procedure msg_fn.tg__on_message_insert();
```

**Channel naming convention:** `{entity}:{id}:{event-type}`
Example: `topic:abc-123:message`

**Payload convention:** `{ event: 'create' | 'update' | 'delete', id: string }`
Do not put the full record in the payload — it will be fetched via HTTP after receipt.

---

## Layer 2: Nitro WebSocket Handler

File location: `server/routes/_ws/{entity}/[id]/{event-type}.ts`
Example: `packages/msg-layer/server/routes/_ws/topics/[id]/messages.ts`

```ts
export default defineWebSocketHandler({
  async upgrade(request) {
    // Validate session — throw if unauthorized
    const session = getCookie(request, 'session')
    if (!session) throw createError({ statusCode: 401 })
    // Attach claims to peer context for use in open()
  },

  async open(peer) {
    const topicId = getTopicIdFromPeer(peer) // from route params
    // Subscribe this peer to the pg LISTEN channel
    await pgListen(`topic:${topicId}:message`, (payload) => {
      peer.send(payload)
    })
  },

  async close(peer) {
    // Cleanup: unsubscribe from pg LISTEN
    await pgUnlisten(peer)
  },
})
```

### Key rules for the handler
- Always validate the session in `upgrade` — reject unauthorized connections early
- One pg LISTEN subscription per peer connection
- Forward the raw notify payload to the peer — do not enrich it
- Clean up LISTEN subscription in `close`

---

## Layer 3: Client Composable

The composable owns the **initial GraphQL load** and the WebSocket lifecycle.
Components never touch WebSocket APIs directly.

This is now a **hybrid**: the ordered message list comes from GraphQL (`useDiscussionByIdQuery`
in `graphql-client-api`); only the real-time incremental "new message" arrival stays on the
WebSocket + the HTTP `withClaims` carve-out (`packages/msg-layer/server/api/topics/[id]/messages/[msgId].get.ts`).
Sends also go through GraphQL (`useUpsertMessageMutation`). See `graphql-api-pattern.md`.

Reference: `apps/msg-app/app/composables/useTopicMessages.ts`
(and `packages/graphql-client-api/src/composables/useMsgTopic.ts` for the richer dedup variant).

```ts
export function useTopicMessages(topicId: MaybeRef<string>) {
  const id = toRef(topicId)
  const messages = ref<MsgMessage[]>([])

  // Initial load: GraphQL (DiscussionById returns the topic + its messages).
  const variables = computed(() => ({ topicId: id.value }))
  const { data } = useDiscussionByIdQuery({ variables })
  watch(data, (val) => {
    const msgs = val?.topic?.messages
    if (msgs) messages.value = msgs.filter(Boolean).map(/* → MsgMessage */)
  }, { immediate: true })

  // Real-time push stays on the WebSocket + REST incremental fetch (not GraphQL).
  let ws: WebSocket | null = null
  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${protocol}//${location.host}/_ws/topics/${id.value}/messages`)

    ws.addEventListener('message', async (event) => {
      const { event: type, id: msgId } = JSON.parse(event.data)
      if (type === 'create') {
        // Fetch the full record from the withClaims carve-out — don't trust the payload as complete.
        const m = await $fetch<MessageWithSender>(`/api/topics/${id.value}/messages/${msgId}`)
        messages.value.push(/* map MessageWithSender → MsgMessage */)
      }
    })

    ws.addEventListener('close', (e) => {
      if (e.code !== 1000) setTimeout(connect, 2000) // reconnect with backoff
    })
  }

  onMounted(connect)
  onUnmounted(() => ws?.close(1000, 'unmounted'))

  return { topic, messages }
}
```

### Key rules for the composable
- Load the ordered message list via **GraphQL** (`useDiscussionByIdQuery`), not a REST list route
- On WS notify: fetch the full record via the HTTP `withClaims` carve-out GET
  (`/api/topics/{id}/messages/{msgId}`) — do not use the WS payload as data. The returned type is
  `MessageWithSender` from `@function-bucket/fnb-db-access`
- Dedup live arrivals against the GraphQL refetch (server copy wins); send via `useUpsertMessageMutation`
- Reconnect automatically on abnormal close (2-second delay is the current standard)
- Close the WebSocket in `onUnmounted` to prevent leaks
- Accept `MaybeRef<string>` for the ID so callers can pass either a ref or a plain string

---

## Layer 4: Vue Component

Components receive reactive data from the composable and render it.
No WebSocket, `$fetch`, or `useFetch` calls inside components.

```vue
<script setup lang="ts">
const props = defineProps<{ topicId: string }>()
const { messages } = useTopicMessages(toRef(props, 'topicId'))
</script>

<template>
  <div v-for="msg in messages" :key="msg.id">
    {{ msg.content }}
  </div>
</template>
```

---

## Adding a New Real-Time Feature — Checklist

1. **DB trigger** — fire `pg_notify` with channel name + minimal payload `{ event, id }`
2. **Nitro WS handler** — `server/routes/_ws/{entity}/[id]/{type}.ts`; validate session in `upgrade`, LISTEN in `open`, cleanup in `close`
3. **HTTP endpoint for single record** — needed so the composable can fetch the full record on notify
4. **Composable** — initial fetch + WebSocket lifecycle + reconnect logic
5. **Component** — consumes composable only

---

## What NOT to Do

- Do not put business data in the pg_notify payload — always fetch via HTTP after receipt
- Do not open WebSocket connections inside Vue components
- Do not reconnect synchronously on error — always use a delay
- Do not forget to close the WebSocket in `onUnmounted`
- Do not skip session validation in the WebSocket `upgrade` handler
