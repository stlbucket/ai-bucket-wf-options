// Plain flat shapes for the poll module. Enum unions mirror the GraphQL enums (UPPERCASE) so
// mappers pass enum values straight through. See .claude/specs/tenant-app/tools/poll/_shared.data.md.
import type { Urn } from '@/urn'

export type PollStatus = 'DRAFT' | 'OPEN' | 'CLOSED'
export type QuestionType = 'YES_NO' | 'MULTIPLE_CHOICE' | 'DATE_YES_NO'
export type ResultsVisibility = 'HIDDEN' | 'AGGREGATE' | 'ATTRIBUTED'

export interface Poll {
  id: string
  urn: Urn
  tenantId: string
  title: string
  description: string | null
  status: PollStatus
  closesAt: Date | null
  allowChangeAfterSubmit: boolean
  resultsVisibility: ResultsVisibility
  createdByResidentUrn: Urn
  createdAt: Date
  updatedAt: Date
}

export interface PollOption {
  id: string
  questionId: string
  ordinal: number
  label: string | null // null on date_yes_no rows displayed via candidateAt
  candidateAt: Date | null // authored candidate date/time (scheduling poll / date_yes_no date)
}

export interface PollQuestion {
  id: string
  pollId: string
  ordinal: number
  questionType: QuestionType
  prompt: string
  required: boolean
  maxSelections: number | null // multiple_choice: 1 = single, N = up to N, null = unlimited
  allowOther: boolean
  allowNote: boolean // respondent may attach a free-text note to their answer
  collectDatetime: boolean // ask the respondent to supply a date/time
  contextAt: Date | null // authored, whole-question date/time
  options: PollOption[]
}

export interface PollAnswer {
  id: string
  questionId: string
  optionId: string | null
  yesNo: boolean | null
  otherText: string | null
  note: string | null // respondent note (allow_note); attributed-only in results
  answerAt: Date | null // respondent-supplied date/time
}

export interface PollResponse {
  id: string
  pollId: string
  respondentResidentUrn: Urn
  submittedAt: Date | null // null = in progress; set on submit
  answers: PollAnswer[]
}

// One aggregate-results row (identity-free). For yes_no questions optionId is null and the
// yes/no counts populate; for multiple_choice one row per option (+ a synthetic "Other" row where
// optionId is null and otherCount > 0). Mirrors poll_fn.question_result.
export interface PollQuestionResult {
  questionId: string
  optionId: string | null
  label: string | null
  candidateAt: Date | null
  voteCount: number
  yesCount: number
  noCount: number
  otherCount: number
  respondentCount: number
}
