import { computed, toRef } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useDiscussionBySubjectQuery, useUpsertTopicMutation } from '../generated/fnb-graphql-api'
import type { MsgTopic } from './useMsgTopic'

// The discussion about one todo, addressed by the todo's URN (urn-registry stacking v2 —
// topics carry subject_urn; the old id-sharing hack is gone, topics have their own ids).
export function useTodoMsg(todoUrn: MaybeRefOrGetter<string>) {
  const urn = toRef(todoUrn)
  const variables = computed(() => ({ subjectUrn: urn.value }))
  const { data, fetching, executeQuery } = useDiscussionBySubjectQuery({
    variables,
    pause: computed(() => !urn.value),
  })

  const { executeMutation: execUpsertTopic } = useUpsertTopicMutation()

  const topic = computed<MsgTopic | null>(() => {
    const t = (data.value?.topics ?? []).find((x) => x != null)
    if (!t) return null
    return {
      id: String(t.id),
      name: t.name,
      identifier: t.identifier ?? null,
      status: t.status,
    }
  })

  const hasTopic = computed(() => !!topic.value)

  async function startDiscussion(name: string, participantUrns: string[], initialMessage: string) {
    const result = await execUpsertTopic({
      topicInfo: {
        name,
        subjectUrn: urn.value,
        subscribers: participantUrns.map((residentUrn) => ({ residentUrn })),
        initialMessage: initialMessage || null,
      },
    })
    if (result.error) throw result.error
    executeQuery({ requestPolicy: 'network-only' })
  }

  return { topic, hasTopic, fetching, startDiscussion }
}
