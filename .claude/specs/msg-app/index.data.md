# msg-app/index — Topic List Data


> **URN stacking v2 (2026-07-10):** `msg.topic.context` is **removed**; topics carry
> `subject_urn text REFERENCES res.resource(urn)` (partial-unique — one discussion per subject).
> `createTopic` has no `domain` param; `TopicInfoInput` has `subjectUrn`, no `context`. The todo
> discussion no longer shares the todo's id — `useTodoMsg(todoUrn)` queries `DiscussionBySubject`
> and topics have their own ids/registry rows. Authoritative contract:
> `.claude/specs/urn-registry/stacking-v2.data.md`. `context`/id-sharing mentions below are historical.

## Status
Implemented — GraphQL

## Route
`/messages` — see `index.ui.md` for UI details. The page is provided by msg-layer
(`packages/msg-layer/app/pages/messages/index.vue`) and calls `useMsgTopics()`.

## GraphQL

| Operation | `.graphql` file | Generated hook | Notes |
|---|---|---|---|
| Fetch inbox | `msg/query/mySubscribedTopics.graphql` | `useMySubscribedTopicsQuery()` | Current resident's `subscribersList` (ACTIVE) → shaped into `SubscribedTopicSummary[]`; replaced `GET /api/topics` |
| Create topic | `discussions/mutation/upsertTopic.graphql` | `useUpsertTopicMutation()` | `executeMutation({ topicInfo })` — `TopicInfoInput` carries `subscribers` + `initialMessage`, so the DB function creates topic + subscribers + first message in one call; replaced `POST /api/topics` |

The former REST routes (`GET`/`POST /api/topics`) no longer exist — the msg-layer `server/` now
holds only the WebSocket carve-out.

## Composable

**Source**: `packages/graphql-client-api/src/composables/useMsgTopics.ts` (`useMsgTopics`)
**Re-export**: `packages/msg-layer/app/composables/useMsgTopics.ts`
(`export { useMsgTopics, type TopicSummary } from '@function-bucket/fnb-graphql-client-api'`)

Returns `{ topics: SubscribedTopicSummary[], fetching, error, createTopic, executeQuery }`.
`createTopic(name, participantIds?, initialMessage?, domain?)` runs `UpsertTopic` then re-runs the
inbox query `network-only`. No `refresh` — use `executeQuery({ requestPolicy: 'network-only' })`.

_(The earlier "R1 violation" gap — `index.vue` calling `useFetch`/`$fetch` directly — is resolved;
`useMsgTopics()` now wraps both list and create.)_

## Types
See `_shared.data.md` → GraphQL Operations, Composable View Types (`SubscribedTopicSummary`).
