# msg-app — Shared Data Types & Permissions

> **URN-registry migration (2026-07-10):** the `<module>_tenant`/`<module>_resident` mirror
> tables, `ensure_<module>_resident`, and the `handle_update_profile` triggers described below
> are **removed**. Resident references are now URN columns (`posted_by_resident_urn`,
> `resident_urn` — `text REFERENCES res.resource(urn)`); `tenant_id` FKs point at
> `app.tenant(id)`; display names resolve via `resourceBy…Urn { resident { displayName } }`;
> the resident picker is the shared `residentsList` query (`ActiveTenantResidents`). Registered
> tables carry a generated `urn` column. Authoritative contract: `.claude/specs/urn-registry/`
> (`_shared.data.md` §5–§6). Mirror-table details below are historical.


Referenced by all `msg-app/*.data.md` files. Do not duplicate these here.

## Navigation

Registered in DB (`db/fnb-app/deploy/00000000010240_app_fn.sql`):
```
Tool: 'disc-topics' / 'Discussions' / icon: i-lucide-messages-square
Permissions: p:app-user, p:app-admin, p:discussions
Route: /tenant/msg   (external link into msg-app)
```

## Permission Model

| Action | Required |
|---|---|
| View topics / read messages | `p:discussions` |
| Send messages / create topics | `p:discussions` |

Enforcement: `msg_api.*` PL/pgSQL functions (`jwt.enforce_permission('p:discussions')`) + RLS on
all `msg.*` tables. On the default GraphQL path, RLS fires via PostGraphile's `grafast.context()`
→ `pgSettings`. The one non-GraphQL read (WS incremental message) uses `withClaims(claims, fn)`
(2-arg, `db-access`).

## DB Schema

The msg feature lives in a separate schema (`fnb-msg`), distinct from `fnb-app`.
Bridge tables map app-layer tenants and residents into the msg schema.

**msg.topic**
| Field | Type | Notes |
|---|---|---|
| id | TopicId | |
| tenantId | MsgTenantTenantId | |
| name | string | |
| identifier | string \| null | unique per tenant |
| tags | string[] | |
| status | TopicStatus | open, closed, locked |
| createdAt | Date | |

**msg.message**
| Field | Type | Notes |
|---|---|---|
| id | MessageId | |
| tenantId | MsgTenantTenantId | |
| topicId | TopicId | |
| content | string | |
| postedByMsgResidentId | MsgResidentResidentId | |
| tags | string[] | |
| status | MessageStatus | draft, sent, deleted |
| createdAt | Date | |

After INSERT, a DB trigger fires `pg_notify('topic:{topicId}:message', '{"event":"create","id":"..."}')`.

**msg.subscriber**
| Field | Type | Notes |
|---|---|---|
| id | SubscriberId | |
| tenantId | MsgTenantTenantId | |
| topicId | TopicId | |
| msgResidentId | MsgResidentResidentId | unique per (topic, resident) |
| lastRead | Date | |
| status | SubscriberStatus | active, inactive, blocked |
| createdAt | Date | |

**msg.msgTenant** / **msg.msgResident** — bridge tables mapping `app.tenant` / `app.resident` into the msg schema.

## Generated GraphQL Types (`packages/graphql-client-api/src/generated/fnb-graphql-api.ts`)

`Topic`, `Message`, `Subscriber`, `Resident`, status enums `TopicStatus` / `MessageStatus` /
`SubscriberStatus`, and inputs `TopicInfoInput` / `MessageInfoInput` / `SubscriberInfoInput` —
all generated from the PostGraphile schema (do not edit).

## GraphQL Operations (msg)

The msg GraphQL documents live under `packages/graphql-client-api/src/graphql/discussions/` (+
`graphql/msg/query/mySubscribedTopics.graphql`). Full list in `tenant-app/msg/_shared.data.md`
→ GraphQL Operations. The ones msg-app uses:

| Operation | Generated hook | Used by |
|---|---|---|
| `MySubscribedTopics` | `useMySubscribedTopicsQuery()` | inbox (`useMsgTopics`, re-exported via msg-layer) |
| `DiscussionById($topicId: UUID!)` | `useDiscussionByIdQuery()` | conversation (`useTopicMessages`) |
| `UpsertTopic($topicInfo: TopicInfoInput!)` | `useUpsertTopicMutation()` | create topic |
| `UpsertMessage($messageInfo: MessageInfoInput!)` | `useUpsertMessageMutation()` | send message |

## Composable View Types (declared in `graphql-client-api` composables, R4)

```ts
// useMsgTopics.ts — SubscribedTopicSummary (aka TopicSummary, deprecated alias)
{ id, name, status: TopicStatus, createdAt: Date, lastMessageAt: Date | null,
  isUnread: boolean, participantNames: string[] }
// useMsgTopic.ts — MsgTopic / MsgMessage
```

## Root-of-trust type (`db-access`, hand-written)

`MessageWithSender` (`packages/db-access/src/types/message-with-sender.ts`):
`{ id, topicId, content, createdAt, status, postedByMsgResidentId, senderDisplayName: string | null }`
— returned by `selectMessageWithSenderById(client, id)` on the WS `withClaims` carve-out
(`GET /api/topics/[id]/messages/[msgId]`); see `[id].data.md`.

## Mutations (via PostGraphile `msg_api`)

| Mutation | DB function | Permission |
|---|---|---|
| `UpsertTopic` | `msg_api.upsert_topic()` | `p:discussions` |
| `UpsertMessage` | `msg_api.upsert_message()` | `p:discussions` |
| `UpsertSubscriber` | `msg_api.upsert_subscriber()` | `p:discussions` |

`upsert_message`: if `topicId` is omitted, auto-creates a topic. Every message INSERT triggers
`pg_notify` via the DB trigger (drives the WebSocket).
