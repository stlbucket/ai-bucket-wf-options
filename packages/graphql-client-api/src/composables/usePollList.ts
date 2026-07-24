import { computed, ref, toRef } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import {
  useSearchPollsQuery,
  useCreatePollMutation,
  PollStatus as GqlPollStatus,
  type SearchPollsQueryVariables,
} from '../generated/fnb-graphql-api'
import type { PollStatus, ResultsVisibility } from '@function-bucket/fnb-types'

// List-row view type (R4). Flat shape the list components render.
export interface PollListItem {
  id: string
  urn: string
  title: string
  description: string | null
  status: PollStatus
  closesAt: Date | null
  resultsVisibility: ResultsVisibility
  createdAt: Date
  updatedAt: Date
  createdByName: string | null
  questionCount: number
  answered: boolean // my response is submitted
  responseInProgress: boolean // my response exists but not yet submitted
}

// `myUrn` is the caller's resident URN (urn:fnb:{tenant}:app:resident:{id}) — supplied by the page
// from useAuth() claims; used to resolve "my response" without leaking others'.
export function usePollList(myUrn: MaybeRefOrGetter<string>) {
  const urn = toRef(myUrn)
  const filter = ref<{ searchTerm?: string; pollStatus?: PollStatus; mineOnly?: boolean }>({})

  const variables = computed<SearchPollsQueryVariables>(() => ({
    options: {
      searchTerm: filter.value.searchTerm || null,
      pollStatus: (filter.value.pollStatus ?? null) as unknown as GqlPollStatus | null,
      mineOnly: filter.value.mineOnly ?? false,
    },
    myUrn: urn.value,
  }))

  const { data, fetching, error, executeQuery } = useSearchPollsQuery({
    variables,
    pause: computed(() => !urn.value),
  })
  const { executeMutation: execCreate } = useCreatePollMutation()

  const polls = computed<PollListItem[]>(() =>
    (data.value?.searchPollsList ?? [])
      .filter((p): p is NonNullable<typeof p> => p != null)
      .map((p) => {
        const mine = (p.myResponse ?? [])[0]
        return {
          id: String(p.id),
          urn: String(p.urn),
          title: p.title,
          description: p.description ?? null,
          status: p.status as unknown as PollStatus,
          closesAt: p.closesAt != null ? new Date(String(p.closesAt)) : null,
          resultsVisibility: p.resultsVisibility as unknown as ResultsVisibility,
          createdAt: new Date(String(p.createdAt)),
          updatedAt: new Date(String(p.updatedAt)),
          createdByName: p.createdByResident?.resident?.displayName ?? null,
          questionCount: p.questions?.totalCount ?? 0,
          answered: !!mine?.submittedAt,
          responseInProgress: !!mine && !mine.submittedAt,
        }
      })
      .sort((a, b) => {
        if (a.status === 'OPEN' && b.status !== 'OPEN') return -1
        if (a.status !== 'OPEN' && b.status === 'OPEN') return 1
        return b.updatedAt.getTime() - a.updatedAt.getTime()
      }),
  )

  function search(searchTerm: string, pollStatus?: PollStatus, mineOnly?: boolean) {
    filter.value = { searchTerm: searchTerm || undefined, pollStatus, mineOnly }
  }

  async function createPoll(title: string, description?: string): Promise<{ id: string }> {
    const result = await execCreate({ title, description })
    if (result.error) throw result.error
    const id = result.data?.createPoll?.poll?.id
    if (!id) throw new Error('No poll id returned')
    executeQuery({ requestPolicy: 'network-only' })
    return { id: String(id) }
  }

  return { polls, fetching, error, search, createPoll, executeQuery }
}
