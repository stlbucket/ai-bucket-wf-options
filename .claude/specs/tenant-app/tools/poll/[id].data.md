# tools/poll/[id] — Poll Detail Data

## Status
Implemented — GraphQL (2026-07-23). See README for verification + the deferred OTP phase.
**2026-07-23 improvements round — Implemented same day:** input-type extensions for
`date_yes_no` + `allow_note`/`note` (marked NEW below); operation names/hooks and the composable
surface are unchanged.

## Route
`/tenant/tools/poll/[id]` — see `[id].ui.md` for UI details

## GraphQL

### Query on load
- **Query name**: `PollById`
- **File** (to create): `packages/graphql-client-api/src/graphql/poll/query/pollById.graphql`
- **Generated hook**: `usePollByIdQuery()`
- **Variables**: `id: UUID!` (from `route.params.id`)
- **Returns** the full poll tree:
  - poll fields (`_shared.data.md` §7) + `createdByResident { displayName }`
  - `questions` (ordered by `ordinal`), each with `options` (ordered) — the authoring/answering
    structure
  - **the caller's own** `response { id, submittedAt, answers { questionId, optionId, yesNo,
    otherText, answerAt } }` (RLS returns only my response; used to pre-fill the answer form)
- **404 behavior**: if `data.poll` is null → redirect to `/tenant/tools/poll`

### Results query (visibility-gated)
- **Query name**: `PollResults`
- **File** (to create): `packages/graphql-client-api/src/graphql/poll/query/pollResults.graphql`
- **Generated hook**: `usePollResultsQuery()`
- **Backing fn**: `poll_api.get_poll_results(_poll_id)` (`_shared.data.md` §6) — identity-free
  per-question / per-option counts + `respondentCount`.
- **When run**: only when `resultsVisibility !== 'HIDDEN'` **or** the caller is the poll
  creator / holds `p:poll-admin`. `pause`d otherwise.
- **Attributed extra**: when `resultsVisibility === 'ATTRIBUTED'` (or admin), a second query
  `PollAttributedResponses($pollId)` reads the raw `poll.response`/`poll.answer` rows RLS now
  exposes (§5) + `respondent { displayName }`, so the UI can show *who answered what*.

### Mutations

| Mutation | Hook | Variables | Guard (server) | After success |
|---|---|---|---|---|
| `UpdatePoll` | `useUpdatePollMutation()` | `pollId`, `title`, `description`, `closesAt` | creator/`p:poll-admin` | reload `PollById` |
| `SetPollOptions` | `useSetPollOptionsMutation()` | `pollId`, `allowChangeAfterSubmit`, `resultsVisibility` | creator/admin | reload |
| `SetPollStatus` | `useSetPollStatusMutation()` | `pollId`, `status: PollStatus!` | creator/admin | reload |
| `DeletePoll` | `useDeletePollMutation()` | `pollId` | creator/admin | `navigateTo('/tenant/tools/poll')` |
| `UpsertQuestion` | `useUpsertQuestionMutation()` | `pollId`, `question: QuestionInput!` | creator/admin; **draft** | reload |
| `DeleteQuestion` | `useDeleteQuestionMutation()` | `questionId` | creator/admin; draft | reload |
| `UpsertOption` | `useUpsertOptionMutation()` | `questionId`, `option: OptionInput!` | creator/admin; draft | reload |
| `DeleteOption` | `useDeleteOptionMutation()` | `optionId` | creator/admin; draft | reload |
| `SaveResponse` | `useSaveResponseMutation()` | `pollId`, `answers: [AnswerInput!]!` | `p:poll`; open; not-locked | reload own response |
| `SubmitResponse` | `useSubmitResponseMutation()` | `pollId`, `answers: [AnswerInput!]!` | `p:poll`; open; not-locked | reload own response + results |

`.graphql` files live under `packages/graphql-client-api/src/graphql/poll/mutation/`. Input types
`QuestionInput` / `OptionInput` / `AnswerInput` map to the `poll_fn.*_input` composites
(`_shared.data.md` §6.1) as PostGraphile named-field inputs.

**NEW (2026-07-23):** after the DB deltas + rebuild, re-run codegen — `QuestionInput` gains
`allowNote`, `AnswerInput` gains `note` and `dateAnswers: [DateAnswerInput!]` (from the new
`poll_fn.date_answer_input` composite), the `QuestionType` enum gains `DATE_YES_NO`, and the
`PollById` fragments must select the new fields (`question.allowNote`, `answer.note`). The
mutation documents themselves (names, hooks, guards) do not change. `PollResults` /
`QuestionResult` are shape-stable — date questions come back as one row per date option
(`_shared.data.md` §6.2).

## Composable

- **Source (to create)**: `packages/graphql-client-api/src/composables/usePollDetail.ts`
- **Re-export (to create)**: `apps/tenant-app/app/composables/usePollDetail.ts`

```ts
const {
  poll,            // Ref<PollTree | null>
  myResponse,      // computed from poll.response
  results,         // Ref<PollResults | null> (paused unless visible)
  attributed,      // Ref<AttributedResponse[]> (attributed/admin only)
  canAdmin,        // computed: I'm the creator OR hold p:poll-admin
  fetching, error,
  // admin
  updatePoll, setPollOptions, setStatus, deletePoll,
  upsertQuestion, deleteQuestion, upsertOption, deleteOption,
  // respondent
  saveResponse, submitResponse,
} = usePollDetail(pollId)
```

| Export | Behavior |
|---|---|
| `poll` | `PollTree` from `PollById` (`= NonNullable<PollByIdQuery['poll']>`) |
| `myResponse` | `poll.value?.response ?? null` — pre-fills the answer form + drives locked/submitted state |
| `results` | `PollResults` from `PollResults` query; `pause` unless `resultsVisibility !== 'HIDDEN' || canAdmin` |
| `attributed` | rows from `PollAttributedResponses`; empty unless attributed/admin |
| `canAdmin` | `poll.createdByResidentUrn === myUrn || useAuth().hasPermission('p:poll-admin')` |
| `saveResponse(answers)` | `SaveResponse` → reload own response (autosave, no lock) |
| `submitResponse(answers)` | `SubmitResponse` → reload own response + `results` (network-only) |
| all admin fns | mutate → reload `PollById`; question/option fns only enabled while `status==='DRAFT'` |

`canAdmin` uses `useAuth()` (auth-ui, claims in localStorage) for the permission check and the
caller's resident URN for the creator check — no extra query.

## Discussion (reuse — `_shared.data.md` §8)
`usePollMsg(poll.urn)` — a copy of `useTodoMsg`, queried by the poll's URN. Renders `PollMsg.vue`
(copy of `TodoMsg.vue`) with `topic.id`. No new `.graphql` files. Requires `p:discussions`.

## OTP deep-link share (reuse — `_shared.data.md` §9)
`useDeepLink()` (otp-login `share-link.data.md`): `shareToLink(poll.urn)` ("Copy quick-login
link") and `sendDeepLink(poll.urn, residentIds, message, channels)` ("Send to residents"). **Gated
on the otp-login spec shipping** — omit the buttons until then. Add `poll:` to
`apps/auth-app/server/utils/urn-route.ts` so an opened poll link lands on this page.

## Types
`PollTree = NonNullable<PollByIdQuery['poll']>`; `PollTreeQuestion = PollTree['questions'][number]`.
Use the generated query types directly (no hand-written interfaces). Base entity types:
`_shared.data.md` §7.

## Decisions
- **One page, two modes** (CHANGED 2026-07-23; was three): the same `[id].vue` is the **draft
  editor** (creator/admin while `status==='DRAFT'`, single column, no discussion) and the
  **published two-column page** (answer form with per-question inline expandable results on the
  left, discussion on the right). Results are no longer a separate mode. Mode is derived from
  `status` + `canAdmin` + `myResponse.submittedAt`.
- **Inline results need no new queries** (NEW): `PollResults` + `PollAttributedResponses` load
  once (same gating/pauses as before); the UI groups their rows by `questionId` for the
  per-question collapsibles.
- **Autosave vs submit**: `saveResponse` persists without locking; `submitResponse` sets
  `submittedAt`. If `allowChangeAfterSubmit===false`, the form is read-only after submit.
- **Results gating** is enforced server-side (`get_poll_results` + RLS) — the client `pause`
  mirrors it for UX but is not the security boundary.
- **Structure freeze**: question/option editing is disabled once the poll leaves `draft` (server
  rejects it too) — prevents invalidating existing answers.
