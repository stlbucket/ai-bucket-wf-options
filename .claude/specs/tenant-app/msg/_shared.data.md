# msg — Shared Data Types, DB Schema & Permissions

> **URN-registry migration (2026-07-10):** the `<module>_tenant`/`<module>_resident` mirror
> tables, `ensure_<module>_resident`, and the `handle_update_profile` triggers described below
> are **removed**. Resident references are now URN columns (`posted_by_resident_urn`,
> `resident_urn` — `text REFERENCES res.resource(urn)`); `tenant_id` FKs point at
> `app.tenant(id)`; display names resolve via `resourceBy…Urn { resident { displayName } }`;
> the resident picker is the shared `residentsList` query (`ActiveTenantResidents`). Registered
> tables carry a generated `urn` column. Authoritative contract: `.claude/specs/urn-registry/`
> (`_shared.data.md` §5–§6). Mirror-table details below are historical.


Referenced by all `msg/*.data.md` files.

## Navigation
```sql
row('msg'::citext,'Messages'::citext,'{"p:discussions"}'::citext[],
    'i-lucide-messages-square'::citext,'/tenant/msg',0)::app_fn.tool_info
```
Note: the nav entry above is registered **directly in the DB** (R14) and rides `ProfileClaims.modules` into `useAppNav()`. There is no client-side nav plugin (the old `msg-layer/app/plugins/nav-register.ts` / `useNavRegistry` pattern is retired and no longer exists in code).

## Permission Model
| Action | Required |
|---|---|
| View topics / send messages / create topics | `p:discussions` |

Enforced at: PostgreSQL RLS (all `msg.*` tables) and `msg_api` functions
(`jwt.enforce_permission('p:discussions')`). On the default GraphQL path, RLS fires via
PostGraphile's `grafast.context()` → `pgSettings` (`role: 'authenticated'` + `request.jwt.claims`).
There is no Nitro `withClaims` on this path — the one exception is the WebSocket incremental
message read (see `[id].data.md`), which uses `withClaims(claims, fn)` from `db-access`.

## Database Schema (`db/fnb-msg/`)

Sqitch deploy order:
1. `00000000010400_msg` — schema, enums, tables
2. `00000000010408_msg_fn_types` — type definitions
3. `00000000010410_msg_fn` — functions and triggers
4. `00000000010420_msg_policies` — RLS policies and grants

### Enums
- `msg.topic_status`: `open` | `closed` | `locked`
- `msg.message_status`: `draft` | `sent` | `deleted`
- `msg.subscriber_status`: `active` | `inactive` | `blocked`

### Tables

**msg.msg_tenant** — mirrors `app.tenant`
| tenant_id (uuid PK → app.tenant) | name (citext) |

**msg.msg_resident** — mirrors `app.resident`
| resident_id (uuid PK → app.resident) | tenant_id | display_name (citext) |

**msg.topic**
| id | tenant_id | name (citext) | identifier (text, unique per tenant) | tags (citext[]) | status | created_at |

**msg.message**
| id | tenant_id | topic_id | posted_by_msg_resident_id | content (citext) | status | tags (text[]) | created_at |

**msg.subscriber**
| id | tenant_id | topic_id | msg_resident_id | status | last_read (timestamptz) | created_at |
| UNIQUE (topic_id, msg_resident_id) |

### DB Functions

**msg_fn (internal)**
| Function | What it does |
|---|---|
| `ensure_msg_resident(resident_id)` | Creates msg_tenant + msg_resident if missing |
| `upsert_topic(topic_info, resident_id)` | Creates/updates topic; auto-ensures msg_resident |
| `upsert_message(message_info, resident_id)` | Creates message; auto-creates topic if null; auto-subscribes sender |
| `upsert_subscriber(subscriber_info)` | Creates/reactivates subscriber |
| `deactivate_subscriber(subscriber_id)` | Sets status = 'inactive' |
| `delete_topic(topic_id)` | Cascade deletes messages, subscribers, then topic |

**msg_api (public, permission-gated, PostGraphile mutation surface)** — all enforce
`jwt.enforce_permission('p:discussions')` then delegate to the matching `msg_fn`
- `msg_api.upsert_topic`, `upsert_message`, `upsert_subscriber`, `deactivate_subscriber`, `delete_topic`

### Trigger
**`tg__topic_subscription`** — on INSERT to `msg.message`:
```sql
pg_notify('topic:{topic_id}:message', '{"event":"create","id":"{message_id}"}')
```
**`msg_on_app_profile_updated`** — on UPDATE to `app.profile`: syncs `display_name` to `msg.msg_resident`.

## GraphQL Client Setup

- **urql plugin**: `apps/tenant-app/app/plugins/urql.client.ts` — `preferGetMethod: false`,
  exchanges: `cacheExchange → mapExchange(onError) → fetchExchange`, `url` from
  `runtimeConfig.public.graphqlApiUrl`; provides `$urqlClient`.
- **Composable source**: `packages/graphql-client-api/src/composables/`
- **Tenant-app re-exports**: `apps/tenant-app/app/composables/useMsgTopics.ts` (→ `useMsgTopics`,
  `useMsgResidents`) and `useMsgTopic.ts` (→ `useMsgTopic`).
- **GraphQL documents**: `packages/graphql-client-api/src/graphql/` — the `discussions/` folder IS
  the msg module's GraphQL representation (fragments `Topic`, `Message`, `Subscriber`; queries
  `AllDiscussions`, `DiscussionById`, `ActiveTenantResidents`; mutations `UpsertTopic`,
  `UpsertMessage`, `UpsertSubscriber`). Plus `graphql/msg/query/mySubscribedTopics.graphql`
  (`MySubscribedTopics`, used by the inbox).
- **Generated hooks**: `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`
  (`graphql-codegen`, do not edit). `TopicInfoInput`/`MessageInfoInput`/`SubscriberInfoInput` and
  `TopicStatus` are generated from the PostGraphile schema.

## GraphQL Operations (msg)

| Operation | `.graphql` file | Generated hook | Used by |
|---|---|---|---|
| `MySubscribedTopics` | `msg/query/mySubscribedTopics.graphql` | `useMySubscribedTopicsQuery()` | inbox (`useMsgTopics`) |
| `DiscussionById($topicId: UUID!)` | `discussions/query/discussionById.graphql` | `useDiscussionByIdQuery()` | conversation (`useMsgTopic`) |
| `ActiveTenantResidents` | `discussions/query/msgResidents.graphql` | `useActiveTenantResidentsQuery()` | participant picker (`useMsgResidents`) |
| `AllDiscussions` | `discussions/query/allDiscussions.graphql` | `useAllDiscussionsQuery()` | available (topics with counts) |
| `UpsertTopic($topicInfo: TopicInfoInput!)` | `discussions/mutation/upsertTopic.graphql` | `useUpsertTopicMutation()` | create topic |
| `UpsertMessage($messageInfo: MessageInfoInput!)` | `discussions/mutation/upsertMessage.graphql` | `useUpsertMessageMutation()` | send message |
| `UpsertSubscriber($subscriberInfo: SubscriberInfoInput!)` | `discussions/mutation/upsertSubscriber.graphql` | `useUpsertSubscriberMutation()` | subscribe resident |

## Composable View Types
Declared in the composable files (R4), not derived from generated types:
```ts
// useMsgTopics.ts — SubscribedTopicSummary
{ id, name, status: TopicStatus, createdAt: Date, lastMessageAt: Date | null,
  isUnread: boolean, participantNames: string[] }
// useMsgTopics.ts — MsgResidentItem
{ residentId, displayName, tenantId }
// useMsgTopic.ts — MsgTopic / MsgMessage (see [id].data.md)
```

## Root-of-trust type (`db-access`, hand-written)
`MessageWithSender` (`packages/db-access/src/types/message-with-sender.ts`):
`{ id, topicId, content, createdAt, status, postedByMsgResidentId, senderDisplayName: string | null }`
— returned by `selectMessageWithSenderById` on the WS `withClaims` carve-out (see `[id].data.md`).

## Status
Implemented — GraphQL
