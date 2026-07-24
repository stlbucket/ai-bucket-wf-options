# tools/poll/[id] — Poll Detail UI

## Status
Implemented — GraphQL (2026-07-23). See README for verification + the deferred OTP phase.
**2026-07-23 improvements round — Implemented same day:** the sections marked **NEW/CHANGED**
below — draft mode hides discussion, the published page is a fixed two-column layout with
per-question inline expandable results, and the editor/answer form carry the `date_yes_no`
type + `allow_note`.

## Route
`/tenant/tools/poll/[id]` → `apps/tenant-app/app/pages/tenant/tools/poll/[id].vue`

## Required Permission
`p:poll` (answer). `p:poll-admin` **or** being the creator unlocks the admin surface.

## Layout (CHANGED 2026-07-23)
`ClientOnly` → `UCard` that fills height (`flex flex-col grow`, todo detail precedent). One page,
two interlocking modes derived from `status` + `canAdmin` + `myResponse?.submittedAt`
(`[id].data.md` → Decisions):

| Breakpoint | Component |
|---|---|
| `md` and above | `PollDetail` |
| below `md` | `PollDetailSmall` |

**Draft (`status === 'DRAFT'`)** — single column: the draft editor (Mode A) fills the card.
**No discussion** — the rail/panel and its toggle are not rendered at all while drafting (the
discussion belongs to the published conversation, not authoring).

**Published (`status === 'OPEN' | 'CLOSED'`)** — fixed two-column grid on `md+`
(`grid md:grid-cols-[1fr_minmax(20rem,2fr/5)]`-style; left wider):
- **Left column — Questions & answers**: the answer form (Mode B), where each question block
  carries its own **collapsed, expandable results summary** (Mode C, now inline — see below).
- **Right column — Discussion**: `PollMsg`, always visible (replaces the old toggleable
  localStorage rail; no toggle button anymore).

Attachments are out of scope for v1 (Considered & rejected, README).

## Header (all modes)
- `title` (inline click-to-edit when `canAdmin`), `status` badge, `resultsVisibility` badge.
- Admin-only action cluster (when `canAdmin`):
  - status control: **Open** (draft→open), **Close** (open→closed) `UButton`s.
  - **Settings** button → `PollSettingsModal` (the two admin toggles).
  - **Delete** (confirm `UModal`).
  - Share cluster (OTP, gated — `_shared.data.md` §9): **Copy quick-login link** + **Send to
    residents** (omit until otp-login ships).

## Mode A — Draft editor (`canAdmin && status === 'DRAFT'`)
Component: `PollQuestionEditor` (`components/poll/PollQuestionEditor.vue`).
- Ordered list of questions; each editable inline: `prompt`, a `question_type` select
  (`Yes / No` · `Multiple choice` · **`Date list (yes/no per date)`** — NEW), `required` switch.
- **`allow_note` switch on every question type** (NEW) — "Let respondents add a note to their
  answer". Defaults **on** when the type is switched to `Date list`, off otherwise.
- Type-specific controls:
  - **Yes/No**: optional **authored date/time** picker → `context_at` (e.g. "Are you available on
    …?"), `collect_datetime` switch ("also ask the respondent for a date/time").
  - **Multiple choice**: an option editor (label + optional **candidate date/time** →
    `candidate_at` per option, for scheduling polls); `allow_other` switch; a selection-mode
    control writing `max_selections` (**Single answer** = 1 · **Up to N** = N · **Any number** =
    null); `collect_datetime` switch.
  - **Date list (NEW)**: a **date-list editor** — an "Add date" date/time picker appending option
    rows (`candidate_at` required, `label` optional override), rows removable/reorderable. The
    multiple-choice-only controls (`max_selections`, `allow_other`, `collect_datetime`,
    `context_at`) are hidden for this type.
- "Add question" / "Add option" / "Add date" buttons; drag or up/down to reorder (`ordinal`).
- All editor mutations are disabled once `status !== 'DRAFT'` (structure freeze).
- **No discussion panel in draft** (NEW — see Layout).

## Mode B — Answer form (`status === 'OPEN'`, any member — the LEFT column)
Component: `PollResponseForm` (`components/poll/PollResponseForm.vue`), props `poll`, `myResponse`.
- Renders each question:
  - **Yes/No** → `URadioGroup` (Yes / No); if `context_at` present, show it as context text; if
    `collect_datetime`, a `UInput type=datetime-local`/date picker → `answerAt`.
  - **Multiple choice** →
    - `max_selections === 1` → `URadioGroup` of options (single).
    - else → `UCheckboxGroup` (multi, enforce ≤ `max_selections` client-side).
    - each option shows `candidate_at` (formatted) when present.
    - `allow_other` → an "Other" row with a free-text `UInput` → `otherText`.
    - `collect_datetime` → a date/time picker → `answerAt`.
  - **Date list (NEW)** → a compact per-date grid: one row per option (formatted `candidateAt`,
    or `label` override) with a **Yes / No** toggle (`URadioGroup`/segmented) and — when
    `allowNote` — a small note `UInput` per row → `dateAnswers[{optionId, yesNo, note}]`.
    Unanswered rows submit nothing for that date.
  - **Note (NEW)** — any yes_no/multiple_choice question with `allowNote` shows a free-text
    "Add a note" `UInput` under the answer → `note`.
- **Inline results per question (NEW)** — each question block ends with a collapsed results
  summary; expanding it reveals the full breakdown (see Mode C).
- Pre-filled from `myResponse.answers`.
- Footer: **Save** (`saveResponse`, no lock) + **Submit** (`submitResponse`, sets `submittedAt`).
- If `allowChangeAfterSubmit === false && myResponse?.submittedAt` → form is **read-only** with a
  "Your answers are locked" `UAlert` (UC7 persistent). Otherwise a submitted member may re-edit
  and re-submit.
- `status === 'CLOSED'` → form read-only ("This poll is closed").

## Mode C — Results (CHANGED 2026-07-23: inline per question, collapsed by default)
Component: `PollResults` (`components/poll/PollResults.vue`) — now rendered **once per question**
inside the left column's question blocks (props `questionResults`, `attributed`, `expanded`),
not as a separate page mode.
- **Collapsed summary** (always visible when results are visible to the caller): a one-line
  `UCollapsible`/accordion header — e.g. Yes/No: "5 yes · 2 no (7 responses)"; multiple choice:
  "Leading: <top option> (7 responses)"; date list: "Best date: <top candidate_at> (7
  responses)". Chevron to expand.
- **Expanded details**:
  - **Yes/No** → tally bars (yes/no counts + %).
  - **Multiple choice** → per-option bar chart (count + %); Other count; for scheduling polls,
    highlight the winning `candidate_at`.
  - **Date list (NEW)** → per-date yes/no tally bars; highlight the winning date.
  - `ATTRIBUTED` (or admin) → additionally the per-question **Responses** rows from `attributed`
    (`respondent.displayName` → their selections, **including their `note` text** — notes only
    ever appear here, never in aggregate).
- `AGGREGATE` → counts/percentages only, **no names, no notes**.
- `HIDDEN` non-admin → no results section on the question blocks; a single "Results aren't
  shared for this poll" note near the form header instead.
- `respondentCount` / eligible-member context stays in the page header.

## Component: `PollSettingsModal`
*`components/poll/PollSettingsModal.vue`* — the admin toggles:
- `allow_change_after_submit` switch — "Members can change answers after submitting".
- `results_visibility` `URadioGroup`: **Hidden (own only)** · **Aggregate (counts only)** ·
  **Attributed (show names)**.
- `closes_at` optional date/time picker.
- Submit → `@save` → page calls `setPollOptions` / `updatePoll`.

## Status / visibility Badge Colors
Status: same as `index.ui.md`. Visibility badge (UC6): `HIDDEN` neutral · `AGGREGATE` info ·
`ATTRIBUTED` primary.

## User Interactions
| Action | Result |
|---|---|
| (admin) Add/edit question or option | `upsertQuestion`/`upsertOption` → reload (draft only) |
| (admin) Open / Close | `setStatus('OPEN'\|'CLOSED')` → reload |
| (admin) Save settings | `setPollOptions` / `updatePoll` → reload |
| (admin) Delete | confirm → `deletePoll()` → `navigateTo('/tenant/tools/poll')` |
| (member) Save answers | `saveResponse(answers)` → toast "Saved" (UC7), no lock |
| (member) Submit | `submitResponse(answers)` → toast "Submitted"; lock if configured |
| (member) Expand/collapse a question's results | local UI state only (collapsed by default) |
| Start discussion | `PollMsg` → `startDiscussion(...)` (todo pattern; **published polls only**) |
| (admin) Copy link / Send to residents | `shareToLink` / `sendDeepLink` (OTP, gated) |

## Reactive State
```ts
const poll = ref<PollTree | null>(null)      // from PollById
// answer form working copy keyed by questionId, seeded from myResponse.answers
// AnswerDraft now carries note + dateAnswers[{optionId, yesNo, note}] (NEW)
const draftAnswers = ref<Record<string, AnswerDraft>>({})
const expandedResults = ref<Set<string>>(new Set())  // NEW: which questions' results are expanded
```

## Mobile (`PollDetailSmall`)
Same props/emits; the two columns stack (questions & answers first, Discussion below) inside a
`UAccordion`; per-question results summaries stay collapsible; the date-list grid stays one date
per row (UC5). No discussion section while `DRAFT` (same rule as desktop).
