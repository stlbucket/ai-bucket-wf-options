# msg/[id] — Conversation View Data

## Status
Implemented — GraphQL

## Route
`/tenant/msg/[id]` — see `[id].ui.md` for UI details

## GraphQL

| Operation | `.graphql` file | Generated hook | Notes |
|---|---|---|---|
| Fetch topic + messages | `discussions/query/discussionById.graphql` | `useDiscussionByIdQuery()` | Variables: `{ topicId: UUID }` — returns topic, subscribers, last 50 messages; replaces `GET /api/topics/{id}` + `GET /api/topics/{id}/messages` |
| Send message | `discussions/mutation/upsertMessage.graphql` | `useUpsertMessageMutation()` | Variables: `MessageInfoInput` with `topicId` and `content`; replaces `POST /api/topics/{id}/messages` |

`discussionById` returns a single topic with its subscriber list and chronological message thread
(last 50 messages). Equivalent to `selectTopicById` + `selectRecentMessagesByTopicId`.

### Single message fetch (on WebSocket notify) — H3/`withClaims` carve-out, leave as REST
`GET /api/topics/{topicId}/messages/{msgId}`
- Handler: `packages/msg-layer/server/api/topics/[id]/messages/[msgId].get.ts`
- Auth: reads `event.context.claims` (401 if missing), then
  `withClaims(claims, (client) => selectMessageWithSenderById(client, msgId))` — the **2-arg**
  `withClaims` from `@function-bucket/fnb-db-access` (RLS on `msg.message` outside GraphQL)
- Returns: `MessageWithSender` (hand-written type in `db-access`)
- Triggered by the WebSocket notification inside the composable; intentionally NOT GraphQL (the
  authorized incremental read runs outside the GraphQL request lifecycle).

### WebSocket
`WS _ws/topics/{topicId}/messages`
- Handler: `packages/msg-layer/server/routes/_ws/topics/[id]/messages.ts`
- Upgrade: validates the `session` cookie, extracts claims (`getWsUpgradeClaims`)
- Open: pg LISTEN on channel `topic:{topicId}:message` (via `pg-notify-bridge`)
- Message: parses `{ event: 'create', id }` → client fetches the full message via the GET above
- Reconnect: 2-second delay on abnormal close

## Composable

**Source**: `packages/graphql-client-api/src/composables/useMsgTopic.ts`
**Re-export**: `apps/tenant-app/app/composables/useMsgTopic.ts`

This composable is **hybrid**: GraphQL for initial load, WebSocket for real-time push.

```ts
export function useMsgTopic(topicId: Ref<string>) {
  // GraphQL: initial load
  const { data, fetching, error } = useDiscussionByIdQuery({ variables: { topicId } })
  const { executeMutation: execSend } = useUpsertMessageMutation()

  const topic = computed<MsgTopic | null>(() => { /* map data.value?.topic */ })
  // messagesList is aliased to `messages` in DiscussionById — a plain list, no `.nodes`
  const serverMessages = computed<MsgMessage[]>(() =>
    (data.value?.topic?.messages ?? []).filter(Boolean).map(/* → MsgMessage */))

  // WebSocket: real-time push (unchanged from the REST implementation)
  // Connects to _ws/topics/{topicId}/messages
  // On 'create': $fetch<MessageWithSender>(`/api/topics/${topicId}/messages/${msgId}`) → live list
  // Live arrivals are deduped against serverMessages (server copy wins); auto-reconnect 2s backoff

  async function sendMessage(content: string) {
    const result = await execSend({ messageInfo: { topicId: topicId.value, content } })
    if (result.error) throw result.error
  }

  return { topic, messages, fetching, error, sending, sendMessage }
}
```

- `fetching` from `useDiscussionByIdQuery()` replaces `pending` from `useFetch()`
- Send goes through GraphQL (`useUpsertMessageMutation` → `msg_api.upsert_message`)
- WS connection + per-notification `$fetch` to the `withClaims` carve-out remain in this composable
- The tenant-app re-export (`apps/tenant-app/app/composables/useMsgTopic.ts`) points here; the
  simpler `apps/msg-app/app/composables/useTopicMessages.ts` is the msg-app variant

## Types
See `_shared.data.md` → GraphQL Operations, Composable View Types (`MsgTopic`, `MsgMessage`),
Root-of-trust type (`MessageWithSender`).
