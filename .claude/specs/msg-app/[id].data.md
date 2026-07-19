# msg-app/[id] — Topic Detail Data

## Status
Implemented — GraphQL (+ WebSocket incremental read carve-out)

## Route
`/messages/[id]` — see `[id].ui.md` for UI details. Page provided by msg-layer
(`packages/msg-layer/app/pages/messages/[id].vue`), calls `useTopicMessages(topicId)`.

## GraphQL

| Operation | `.graphql` file | Generated hook | Notes |
|---|---|---|---|
| Fetch topic + messages | `discussions/query/discussionById.graphql` | `useDiscussionByIdQuery()` | Variables `{ topicId: UUID }` → topic, `subscribersList`, and `messagesList(orderBy: CREATED_AT_ASC)` (aliased `messages`); replaced `GET /api/topics/[id]` + `GET /api/topics/[id]/messages` |
| Send message | `discussions/mutation/upsertMessage.graphql` | `useUpsertMessageMutation()` | `executeMutation({ messageInfo: { topicId, content } })` → `msg_api.upsert_message`; DB trigger fires `pg_notify` → WS subscribers; replaced `POST /api/topics/[id]/messages` |

The topic-detail, message-list, and send REST routes no longer exist.

### Fetch on WebSocket notify — H3 `withClaims` carve-out (still REST, intentional)
`GET /api/topics/[id]/messages/[msgId]`
- Handler: `packages/msg-layer/server/api/topics/[id]/messages/[msgId].get.ts`
- Auth: `event.context.claims` (401 if missing) → `withClaims(claims, (client) => selectMessageWithSenderById(client, msgId))` (2-arg `withClaims`, `db-access`)
- Returns: `MessageWithSender` (hand-written type in `db-access`)
- Called by the composable after receiving a WS `create` notification — this is the only surviving REST route in msg-layer.

## WebSocket: `/_ws/topics/[id]/messages`

Handler: `packages/msg-layer/server/routes/_ws/topics/[id]/messages.ts`

| Hook | Behavior |
|---|---|
| `upgrade` | Validates session cookie via `getWsUpgradeClaims()`; rejects with 401 if no claims |
| `open` | Subscribes peer to `topic:{id}:message` channel via `nitroApp.pgBridge` |
| `message` | Not used (server → client only) |
| `close` | Unsubscribes peer from channel |
| `error` | Logged; connection dropped |

**Notify payload** (forwarded verbatim from pg_notify): `{ event: 'create', id: string }`

**Bridge:** `packages/msg-layer/server/plugins/pg-notify-bridge.ts`
- Single dedicated `pg.Client` with persistent `LISTEN` connection
- Reference-counted subscriptions per channel — `UNLISTEN` when last peer leaves
- Routes incoming notifications to all WebSocket peers subscribed to that channel

**Client reconnect:** composable auto-reconnects after 2 seconds on non-normal close (code ≠ 1000).

## Composable
`apps/msg-app/app/composables/useTopicMessages.ts` (msg-app's own; hybrid GraphQL + WS)

| Export | Shape | Usage |
|---|---|---|
| `useTopicMessages(topicId)` | Returns `{ topic, messages }` | called in `[id].vue`; owns the GraphQL load + WS lifecycle |

Internal behavior:
1. `useDiscussionByIdQuery({ variables: { topicId } })` loads the topic + ordered `messages`;
   a `watch(data, …)` maps `data.value?.topic?.messages` (a plain list — no `.nodes`) into the `messages` ref
2. Opens a `WebSocket` to `/_ws/topics/{id}/messages` in `onMounted`
3. On WS `{ event: 'create', id }`: `$fetch<MessageWithSender>('/api/topics/{id}/messages/{id}')`
   (the `withClaims` carve-out), appends to `messages`
4. On unmount: closes WS with code 1000 (clean close, no reconnect)
5. On unexpected close (code ≠ 1000): reconnects after 2s

_(The richer `packages/graphql-client-api/src/composables/useMsgTopic.ts` — server+live dedup,
`sendMessage` — is the tenant-app variant; msg-app uses the leaner `useTopicMessages` above. Both
resolved the earlier "R1" gaps: topic name + messages now come from one GraphQL query.)_

## Types
See `_shared.data.md` → GraphQL Operations, Composable View Types, and Root-of-trust type (`MessageWithSender`).
