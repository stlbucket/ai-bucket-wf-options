# msg/index — Topic List / Inbox Data


> **URN stacking v2 (2026-07-10):** `msg.topic.context` is **removed**; topics carry
> `subject_urn text REFERENCES res.resource(urn)` (partial-unique — one discussion per subject).
> `createTopic` has no `domain` param; `TopicInfoInput` has `subjectUrn`, no `context`. The todo
> discussion no longer shares the todo's id — `useTodoMsg(todoUrn)` queries `DiscussionBySubject`
> and topics have their own ids/registry rows. Authoritative contract:
> `.claude/specs/urn-registry/stacking-v2.data.md`. `context`/id-sharing mentions below are historical.

> **URN-registry migration (2026-07-10):** the `<module>_tenant`/`<module>_resident` mirror
> tables, `ensure_<module>_resident`, and the `handle_update_profile` triggers described below
> are **removed**. Resident references are now URN columns (`posted_by_resident_urn`,
> `resident_urn` — `text REFERENCES res.resource(urn)`); `tenant_id` FKs point at
> `app.tenant(id)`; display names resolve via `resourceBy…Urn { resident { displayName } }`;
> the resident picker is the shared `residentsList` query (`ActiveTenantResidents`). Registered
> tables carry a generated `urn` column. Authoritative contract: `.claude/specs/urn-registry/`
> (`_shared.data.md` §5–§6). Mirror-table details below are historical.


## Status
Implemented — GraphQL

## Route
`/tenant/msg` — see `index.ui.md` for UI details

## GraphQL

| Operation | `.graphql` file | Generated hook | Notes |
|---|---|---|---|
| Fetch inbox (subscribed topics) | `msg/query/mySubscribedTopics.graphql` | `useMySubscribedTopicsQuery()` | Returns the current resident's `subscribersList` (status ACTIVE) with each `topic`, its subscribers, and `latestMessage`; shaped into `SubscribedTopicSummary[]` |
| Fetch residents | `discussions/query/msgResidents.graphql` | `useActiveTenantResidentsQuery()` | Queries `residentsList` (`status: ACTIVE`) via PostGraphile; returns all active tenant members for the participant picker |
| Create topic | `discussions/mutation/upsertTopic.graphql` | `useUpsertTopicMutation()` | `executeMutation({ topicInfo })` with a `TopicInfoInput` (id, name, context, subscribers, initialMessage) |

`MySubscribedTopics` returns the topics the current resident is subscribed to, with participant
names, last-message date, and unread status (derived from `lastRead` vs `latestMessage`).

`ActiveTenantResidents` queries `app.resident` with `status: ACTIVE` — RLS scopes results to the
current tenant, returning all active tenant members regardless of prior messaging activity.
`upsert_subscriber` calls `ensure_msg_resident` internally, so subscribing a resident who hasn't
used messaging before auto-creates their `msg_resident` record.

The create-topic mutation calls `msg_api.upsert_topic` (which subscribes participants and posts the
initial message inside the DB function), then re-runs the inbox query `network-only`.

## Composable

**Source**: `packages/graphql-client-api/src/composables/useMsgTopics.ts` (exports `useMsgTopics`
and `useMsgResidents`)
**Re-export**: `apps/tenant-app/app/composables/useMsgTopics.ts`

```ts
export function useMsgTopics(currentResidentId?: MaybeRef<string | undefined>) {
  const { data, fetching, error, executeQuery } = useMySubscribedTopicsQuery()
  const { executeMutation: execCreate } = useUpsertTopicMutation()

  const topics = computed<SubscribedTopicSummary[]>(() =>
    (data.value?.subscribersList ?? [])
      .filter(Boolean)
      /* filter by currentResidentId, derive participantNames / isUnread */
      .map(/* → SubscribedTopicSummary */),
  )

  async function createTopic(name, participantIds = [], initialMessage?, domain = 'discussion') {
    const result = await execCreate({ topicInfo: { id: crypto.randomUUID(), name, context: domain,
      subscribers: participantIds.map((msgResidentId) => ({ msgResidentId })), initialMessage } })
    if (result.error) throw result.error
    executeQuery({ requestPolicy: 'network-only' })   // no `refresh` — re-run the query
    return { id: String(result.data?.upsertTopic?.topic?.id) }
  }

  return { topics, fetching, error, createTopic, executeQuery }
}

export function useMsgResidents() {
  const { data, fetching, error } = useActiveTenantResidentsQuery()
  const residents = computed<MsgResidentItem[]>(() =>
    (data.value?.residentsList ?? []).filter(Boolean).map(/* → MsgResidentItem */))
  return { residents, fetching, error }
}
```

Return shape: `fetching` (replaces `pending`); no `refresh` — call
`executeQuery({ requestPolicy: 'network-only' })` for a manual refresh.

## Types
See `_shared.data.md` → GraphQL Operations, Composable View Types (`SubscribedTopicSummary`, `MsgResidentItem`).
