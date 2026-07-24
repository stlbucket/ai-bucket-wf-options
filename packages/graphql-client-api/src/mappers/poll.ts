import type {
  PollDetailFragment,
  PollResultsQuery,
} from '../generated/fnb-graphql-api'
import type {
  Poll,
  PollQuestion,
  PollOption,
  PollAnswer,
  PollResponse,
  PollQuestionResult,
  PollStatus,
  QuestionType,
  ResultsVisibility,
  Urn,
} from '@function-bucket/fnb-types'

type RawQuestion = PollDetailFragment['questionsList'][number]
type RawOption = RawQuestion['optionsList'][number]
type RawResponse = NonNullable<PollDetailFragment['myResponse']>[number]
type RawAnswer = RawResponse['answersList'][number]
type RawResult = NonNullable<NonNullable<PollResultsQuery['getPollResultsList']>[number]>

const date = (v: unknown): Date | null => (v != null ? new Date(String(v)) : null)

export const toPollOption = (o: RawOption): PollOption => ({
  id: String(o.id),
  questionId: String(o.questionId),
  ordinal: o.ordinal,
  label: o.label ?? null,
  candidateAt: date(o.candidateAt),
})

export const toPollQuestion = (q: RawQuestion): PollQuestion => ({
  id: String(q.id),
  pollId: String(q.pollId),
  ordinal: q.ordinal,
  questionType: q.questionType as unknown as QuestionType,
  prompt: q.prompt,
  required: q.required,
  maxSelections: q.maxSelections ?? null,
  allowOther: q.allowOther,
  allowNote: q.allowNote,
  collectDatetime: q.collectDatetime,
  contextAt: date(q.contextAt),
  options: [...(q.optionsList ?? [])].map(toPollOption).sort((a, b) => a.ordinal - b.ordinal),
})

export const toPollAnswer = (a: RawAnswer): PollAnswer => ({
  id: String(a.id),
  questionId: String(a.questionId),
  optionId: a.optionId != null ? String(a.optionId) : null,
  yesNo: a.yesNo ?? null,
  otherText: a.otherText ?? null,
  note: a.note ?? null,
  answerAt: date(a.answerAt),
})

export const toPollResponse = (r: RawResponse): PollResponse => ({
  id: String(r.id),
  pollId: String(r.pollId),
  respondentResidentUrn: String(r.respondentResidentUrn) as Urn,
  submittedAt: date(r.submittedAt),
  answers: (r.answersList ?? []).map(toPollAnswer),
})

export const toPoll = (f: PollDetailFragment): Poll => ({
  id: String(f.id),
  urn: String(f.urn) as Urn,
  tenantId: String(f.tenantId),
  title: f.title,
  description: f.description ?? null,
  status: f.status as unknown as PollStatus,
  closesAt: date(f.closesAt),
  allowChangeAfterSubmit: f.allowChangeAfterSubmit,
  resultsVisibility: f.resultsVisibility as unknown as ResultsVisibility,
  createdByResidentUrn: String(f.createdByResidentUrn) as Urn,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
})

export const toPollQuestionResult = (r: RawResult): PollQuestionResult => ({
  questionId: String(r.questionId),
  optionId: r.optionId != null ? String(r.optionId) : null,
  label: r.label ?? null,
  candidateAt: date(r.candidateAt),
  voteCount: r.voteCount ?? 0,
  yesCount: r.yesCount ?? 0,
  noCount: r.noCount ?? 0,
  otherCount: r.otherCount ?? 0,
  respondentCount: r.respondentCount ?? 0,
})
