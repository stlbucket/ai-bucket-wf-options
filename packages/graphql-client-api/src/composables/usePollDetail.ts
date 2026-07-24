import { computed, toRef } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import {
  usePollByIdQuery,
  usePollResultsQuery,
  usePollAttributedResponsesQuery,
  useUpdatePollMutation,
  useSetPollOptionsMutation,
  useSetPollStatusMutation,
  useDeletePollMutation,
  useUpsertQuestionMutation,
  useDeleteQuestionMutation,
  useUpsertOptionMutation,
  useDeleteOptionMutation,
  useSaveResponseMutation,
  useSubmitResponseMutation,
  PollStatus as GqlPollStatus,
  QuestionType as GqlQuestionType,
  ResultsVisibility as GqlResultsVisibility,
  type QuestionInputRecordInput,
  type OptionInputRecordInput,
  type AnswerInputRecordInput,
} from '../generated/fnb-graphql-api'
import type {
  Poll,
  PollQuestion,
  PollResponse,
  PollAnswer,
  PollQuestionResult,
  PollStatus,
  QuestionType,
  ResultsVisibility,
} from '@function-bucket/fnb-types'
import { toPoll, toPollQuestion, toPollResponse, toPollQuestionResult } from '../mappers/poll'

// Detail view (R4): the poll header + ordered questions/options + the caller's own response.
export interface PollDetailView extends Poll {
  createdByName: string | null
  questions: PollQuestion[]
  myResponse: PollResponse | null
}

// One attributed response row (shown only when results are ATTRIBUTED / to an admin — RLS decides
// whether other members' rows are returned at all).
export interface AttributedResponseView {
  id: string
  respondentResidentUrn: string
  displayName: string | null
  submittedAt: Date | null
  answers: PollAnswer[]
}

// Draft input shapes the page builds (keeps pages off generated types, R3).
export interface QuestionDraft {
  id?: string | null
  ordinal?: number | null
  questionType: QuestionType
  prompt: string
  required?: boolean
  maxSelections?: number | null
  allowOther?: boolean
  allowNote?: boolean
  collectDatetime?: boolean
  contextAt?: Date | null
}
export interface OptionDraft {
  id?: string | null
  ordinal?: number | null
  label?: string | null // optional on date_yes_no rows (candidate_at is the display)
  candidateAt?: Date | null
}
// One per-date answer for a date_yes_no question (note gated by question.allowNote).
export interface DateAnswerDraft {
  optionId: string
  yesNo: boolean
  note?: string | null
}
export interface AnswerDraft {
  questionId: string
  optionIds?: string[]
  yesNo?: boolean | null
  otherText?: string | null
  note?: string | null
  answerAt?: Date | null
  dateAnswers?: DateAnswerDraft[]
}

const iso = (d?: Date | null): string | null => (d ? d.toISOString() : null)

const toQuestionInput = (q: QuestionDraft): QuestionInputRecordInput => ({
  id: q.id ?? null,
  ordinal: q.ordinal ?? null,
  questionType: q.questionType as unknown as GqlQuestionType,
  prompt: q.prompt,
  required: q.required ?? true,
  maxSelections: q.maxSelections ?? null,
  allowOther: q.allowOther ?? false,
  allowNote: q.allowNote ?? false,
  collectDatetime: q.collectDatetime ?? false,
  contextAt: iso(q.contextAt),
})
const toOptionInput = (o: OptionDraft): OptionInputRecordInput => ({
  id: o.id ?? null,
  ordinal: o.ordinal ?? null,
  label: o.label ?? null,
  candidateAt: iso(o.candidateAt),
})
const toAnswerInput = (a: AnswerDraft): AnswerInputRecordInput => ({
  questionId: a.questionId,
  optionIds: a.optionIds ?? null,
  yesNo: a.yesNo ?? null,
  otherText: a.otherText ?? null,
  note: a.note ?? null,
  answerAt: iso(a.answerAt),
  dateAnswers:
    a.dateAnswers?.map((d) => ({
      optionId: d.optionId,
      yesNo: d.yesNo,
      note: d.note ?? null,
    })) ?? null,
})

export function usePollDetail(pollId: string, myUrn: MaybeRefOrGetter<string>) {
  const urn = toRef(myUrn)
  const detailVars = computed(() => ({ id: pollId, myUrn: urn.value }))

  const { data, fetching, error, executeQuery } = usePollByIdQuery({
    variables: detailVars,
    pause: computed(() => !urn.value),
  })
  const { data: resultsData, executeQuery: execResults } = usePollResultsQuery({
    variables: { pollId },
  })
  const { data: attrData, executeQuery: execAttr } = usePollAttributedResponsesQuery({
    variables: { pollId },
  })

  const { executeMutation: execUpdate } = useUpdatePollMutation()
  const { executeMutation: execSetOptions } = useSetPollOptionsMutation()
  const { executeMutation: execSetStatus } = useSetPollStatusMutation()
  const { executeMutation: execDelete } = useDeletePollMutation()
  const { executeMutation: execUpsertQ } = useUpsertQuestionMutation()
  const { executeMutation: execDeleteQ } = useDeleteQuestionMutation()
  const { executeMutation: execUpsertO } = useUpsertOptionMutation()
  const { executeMutation: execDeleteO } = useDeleteOptionMutation()
  const { executeMutation: execSave } = useSaveResponseMutation()
  const { executeMutation: execSubmit } = useSubmitResponseMutation()

  const poll = computed<PollDetailView | null>(() => {
    const p = data.value?.poll
    if (!p) return null
    return {
      ...toPoll(p),
      createdByName: p.createdByResident?.resident?.displayName ?? null,
      questions: [...(p.questionsList ?? [])]
        .map(toPollQuestion)
        .sort((a, b) => a.ordinal - b.ordinal),
      myResponse: (p.myResponse ?? [])[0] ? toPollResponse((p.myResponse ?? [])[0]) : null,
    }
  })

  const results = computed<PollQuestionResult[]>(() =>
    (resultsData.value?.getPollResultsList ?? [])
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map(toPollQuestionResult),
  )

  const attributed = computed<AttributedResponseView[]>(() =>
    (attrData.value?.poll?.responsesList ?? []).map((r) => ({
      id: String(r.id),
      respondentResidentUrn: String(r.respondentResidentUrn),
      displayName: r.respondent?.resident?.displayName ?? null,
      submittedAt: r.submittedAt != null ? new Date(String(r.submittedAt)) : null,
      answers: (r.answersList ?? []).map(
        (a): PollAnswer => ({
          id: String(a.id),
          questionId: String(a.questionId),
          optionId: a.optionId != null ? String(a.optionId) : null,
          yesNo: a.yesNo ?? null,
          otherText: a.otherText ?? null,
          note: a.note ?? null,
          answerAt: a.answerAt != null ? new Date(String(a.answerAt)) : null,
        }),
      ),
    })),
  )

  function reload() {
    executeQuery({ requestPolicy: 'network-only' })
  }
  function reloadResults() {
    execResults({ requestPolicy: 'network-only' })
    execAttr({ requestPolicy: 'network-only' })
  }

  async function updatePoll(fields: {
    title?: string
    description?: string | null
    closesAt?: Date | null
  }): Promise<void> {
    const r = await execUpdate({
      pollId,
      title: fields.title ?? null,
      description: fields.description ?? null,
      closesAt: iso(fields.closesAt),
    })
    if (r.error) throw r.error
    reload()
  }

  async function setPollOptions(
    allowChangeAfterSubmit: boolean,
    resultsVisibility: ResultsVisibility,
  ): Promise<void> {
    const r = await execSetOptions({
      pollId,
      allowChangeAfterSubmit,
      resultsVisibility: resultsVisibility as unknown as GqlResultsVisibility,
    })
    if (r.error) throw r.error
    reload()
    reloadResults()
  }

  async function setStatus(status: PollStatus): Promise<void> {
    const r = await execSetStatus({ pollId, status: status as unknown as GqlPollStatus })
    if (r.error) throw r.error
    reload()
    reloadResults()
  }

  async function deletePoll(): Promise<void> {
    const r = await execDelete({ pollId })
    if (r.error) throw r.error
  }

  async function upsertQuestion(q: QuestionDraft): Promise<void> {
    const r = await execUpsertQ({ pollId, q: toQuestionInput(q) })
    if (r.error) throw r.error
    reload()
  }
  async function deleteQuestion(questionId: string): Promise<void> {
    const r = await execDeleteQ({ questionId })
    if (r.error) throw r.error
    reload()
  }
  async function upsertOption(questionId: string, o: OptionDraft): Promise<void> {
    const r = await execUpsertO({ questionId, o: toOptionInput(o) })
    if (r.error) throw r.error
    reload()
  }
  async function deleteOption(optionId: string): Promise<void> {
    const r = await execDeleteO({ optionId })
    if (r.error) throw r.error
    reload()
  }

  async function saveResponse(answers: AnswerDraft[]): Promise<void> {
    const r = await execSave({ pollId, answers: answers.map(toAnswerInput) })
    if (r.error) throw r.error
    reload()
  }
  async function submitResponse(answers: AnswerDraft[]): Promise<void> {
    const r = await execSubmit({ pollId, answers: answers.map(toAnswerInput) })
    if (r.error) throw r.error
    reload()
    reloadResults()
  }

  return {
    poll,
    results,
    attributed,
    fetching,
    error,
    executeQuery,
    updatePoll,
    setPollOptions,
    setStatus,
    deletePoll,
    upsertQuestion,
    deleteQuestion,
    upsertOption,
    deleteOption,
    saveResponse,
    submitResponse,
  }
}
