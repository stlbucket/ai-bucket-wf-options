import { computed, unref } from 'vue'
import type { MaybeRef } from 'vue'
import {
  useActiveTenantResidentsQuery,
  useMySubscribedTopicsQuery,
  useUpsertTopicMutation,
} from '../generated/fnb-graphql-api'
import type { TopicStatus } from '../generated/fnb-graphql-api'

export type SubscribedTopicSummary = {
  id: string
  name: string
  status: TopicStatus
  createdAt: Date
  lastMessageAt: Date | null
  isUnread: boolean
  participantNames: string[]
}

/** @deprecated use SubscribedTopicSummary */
export type TopicSummary = SubscribedTopicSummary

export type MsgResidentItem = {
  residentId: string
  urn: string // the reference value modules store (subscriber.residentUrn, ...)
  displayName: string
  tenantId: string
}

export function useMsgTopics(currentResidentId?: MaybeRef<string | undefined>) {
  const { data, fetching, error, executeQuery } = useMySubscribedTopicsQuery()
  const { executeMutation: execCreate } = useUpsertTopicMutation()

  const topics = computed<SubscribedTopicSummary[]>(() => {
    const subs = data.value?.subscribersList ?? []
    const rid = unref(currentResidentId)
    return subs
      .filter((s): s is NonNullable<typeof s> => s != null)
      .filter((s) => !rid || String(s.residentResource?.resident?.id) === rid)
      .map((s) => {
        const t = s.topic
        if (!t) return null
        const myResidentId = String(s.residentResource?.resident?.id)
        const participantNames = (t.topicSubscribers ?? [])
          .filter((p): p is NonNullable<typeof p> => p != null)
          .filter((p) => String(p.residentResource?.resident?.id) !== myResidentId)
          .map((p) => p.residentResource?.resident?.displayName ?? '')
          .filter(Boolean)
        const latestCreatedAt = t.latestMessage?.[0]?.createdAt ?? null
        const isUnread =
          latestCreatedAt != null
            ? new Date(String(latestCreatedAt)) > new Date(s.lastRead ?? 0)
            : false
        return {
          id: String(t.id),
          name: t.name,
          status: t.status,
          createdAt: new Date(String(t.createdAt)),
          lastMessageAt: latestCreatedAt != null ? new Date(String(latestCreatedAt)) : null,
          isUnread,
          participantNames,
        }
      })
      .filter((t): t is SubscribedTopicSummary => t != null)
  })

  async function createTopic(
    name: string,
    participantUrns: string[] = [],
    initialMessage?: string,
  ) {
    const topicId = crypto.randomUUID()
    const result = await execCreate({
      topicInfo: {
        id: topicId,
        name,
        subscribers: participantUrns.map((residentUrn) => ({ residentUrn })),
        initialMessage: initialMessage ?? null,
      },
    })
    if (result.error) throw result.error
    const id = result.data?.upsertTopic?.topic?.id
    if (!id) throw new Error('upsertTopic returned no id')
    executeQuery({ requestPolicy: 'network-only' })
    return { id: String(id) }
  }

  return { topics, fetching, error, createTopic, executeQuery }
}

export function useMsgResidents() {
  const { data, fetching, error } = useActiveTenantResidentsQuery()
  const residents = computed<MsgResidentItem[]>(() =>
    (data.value?.residentsList ?? [])
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((r) => ({
        residentId: String(r.id),
        urn: String(r.urn),
        displayName: r.displayName ?? '',
        tenantId: String(r.tenantId),
      })),
  )

  return { residents, fetching, error }
}
