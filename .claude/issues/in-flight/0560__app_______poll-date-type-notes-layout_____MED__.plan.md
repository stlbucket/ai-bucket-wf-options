# Poll improvements round: `date_yes_no` type · answer notes · published layout

> **Execution Directive:** execute this plan via `/fnb-stack-implementor <this-file>`. It
> implements Phases 7–9 of `.claude/specs/tenant-app/tools/poll/README.md` (locked decisions
> D12–D16). Phases 1–6 of that spec are already built (or deferred — Phase 6/OTP). Contains a
> **USER REBUILD GATE** at the end of Phase A — stop there and ask the user to rebuild.

**Severity:** MED (feature work, user-requested 2026-07-23). **Category:** app.
**Spec:** `.claude/specs/tenant-app/tools/poll/` (`_shared.data.md` §2.1, §3–§7; `[id].ui.md`;
`[id].data.md`; README D12–D16).

## What this delivers

1. **`date_yes_no` question type** (D12) — a question whose options are a list of dates
   (`candidate_at`), answered yes/no **per date**, with an optional per-date note.
2. **`allow_note` per question** (D13) — any question can let respondents attach a free-text
   `note` to their answer; notes are **attributed-only** (never in aggregate results).
3. **Draft hides discussion** (D14) — no `PollMsg` panel while `status === 'DRAFT'`.
4. **Published two-column layout** (D15) — left: answer form with per-question
   collapsed-but-expandable inline results; right: discussion. The separate Results card dies.

DB deltas are **in-place edits** to the four shipped `fnb-poll` deploy files + full rebuild
(D16 — package shipped 2026-07-23, no production data; same posture as the seed-fn edits).

---

## Phase A — DB deltas (in-place edits · ⚠ USER REBUILD GATE at the end)

### A1 — `db/fnb-poll/deploy/00000000011100_poll.sql`
- [ ] `poll.question_type` enum (lines 16–19): add `'date_yes_no'` with the §3 comment.
- [ ] `poll.question` (line ~59, after `allow_other`): add
      `allow_note boolean not null default false`.
- [ ] `poll.option` (lines ~74–76): `label citext null` (drop `not null`), replace
      `check (char_length(label) >= 1)` with
      `check (label is not null or candidate_at is not null)` +
      `check (label is null or char_length(label) >= 1)`.
- [ ] `poll.answer` (line ~104, after `other_text`): add `note citext null`.

### A2 — `db/fnb-poll/deploy/00000000011110_poll_fn_types.sql`
- [ ] `poll_fn.question_input` (lines 6–16): add `allow_note boolean` (after `allow_other`).
- [ ] New composite `poll_fn.date_answer_input (option_id uuid, yes_no boolean, note citext)`.
- [ ] `poll_fn.answer_input` (lines 27–33): add `note citext` (after `other_text`) and
      `date_answers poll_fn.date_answer_input[]` (last).

### A3 — `db/fnb-poll/deploy/00000000011120_poll_fn.sql`
- [ ] `poll_fn.upsert_question` (lines 155–188): write `allow_note`
      (`coalesce(_q.allow_note, false)`); when `_q.question_type = 'date_yes_no'` force
      `max_selections/context_at → null`, `allow_other/collect_datetime → false` (spec §6.2
      structure-edit guards).
- [ ] `poll_fn.upsert_option` (lines 218–244): after loading `_question`, raise when the
      question is `date_yes_no` and `_o.candidate_at is null`; raise when it is
      `multiple_choice` and insert would leave `label` null (label stays required for mc);
      update arm: `label = _o.label` may now be null for date rows (keep
      `coalesce` only for mc).
- [ ] `poll_fn.save_response` (lines 281–362): third branch for
      `_question.question_type = 'date_yes_no'` — iterate `_a.date_answers`: assert option
      belongs to the question (reuse the 30040 pattern), `yes_no is not null`, no duplicate
      `option_id`, `note` only when `_question.allow_note`; insert one row per entry
      (`option_id`, `yes_no`, `note`). Reject non-null `_a.date_answers` on other types.
      For `yes_no`/`multiple_choice`: persist `_a.note` (gated on `allow_note`) on the
      question's first written answer row.
- [ ] `poll_fn.get_poll_results` (lines 398–446): restrict the per-option arm (lines 429–435)
      to `multiple_choice` questions (join `poll.question` on `o.question_id`); add a
      `date_yes_no` arm — one row per option: `o.question_id, o.id, o.label, o.candidate_at,
      (yes+no) as vote_count, count(*) filter (where a.yes_no) yes_count, count(*) filter
      (where a.yes_no is false) no_count, 0, _respondent_count` joining `poll.answer` on
      `a.option_id = o.id`. **Never select `note`** (D13 visibility rule).

### A4 — package hygiene
- [ ] Keep `db/fnb-poll/{revert,verify}/*` consistent with the edited deploys (run
      `/true-up-sqitch-package db/fnb-poll` if verify files assert columns/types).
- [ ] No `sqitch.plan` changes (same four changes, edited in place — D16). Never run `git`
      during the sqitch session.

### A5 — ⚠ USER REBUILD GATE
- [ ] **Stop. Ask the user to run `pnpm env-rebuild`** (never rebuild yourself). After they
      confirm, verify read-only via psql: enum has 3 values; `question.allow_note`,
      `answer.note`, nullable `option.label` exist; `poll_fn.date_answer_input` exists.

---

## Phase B — client (`graphql-client-api` · `fnb-types`) — after the rebuild

### B1 — types & mappers
- [ ] `packages/fnb-types/src/poll.ts`: `QuestionType` + `'DATE_YES_NO'` (line 6);
      `PollQuestion.allowNote: boolean` (after `allowOther`, line 40);
      `PollOption.label: string | null` (line 28); `PollAnswer.note: string | null` (line 51).
- [ ] `packages/graphql-client-api/src/mappers/poll.ts`: `toPollOption` label passthrough
      (`o.label ?? null`), `toPollQuestion` + `allowNote`, `toPollAnswer` + `note`.

### B2 — GraphQL documents + codegen
- [ ] `src/graphql/poll/fragment/PollDetail.graphql`: select `allowNote` under `questionsList`,
      `note` under `myResponse.answersList`.
- [ ] `src/graphql/poll/query/pollAttributedResponses.graphql`: select `note` under
      `answersList`.
- [ ] Run `pnpm -F @function-bucket/fnb-graphql-client-api generate` (live schema — post-
      rebuild). Confirm `QuestionType.DateYesNo`, `AnswerInputRecordInput.note`/`.dateAnswers`,
      `DateAnswerInputRecordInput` appear in `src/generated/fnb-graphql-api.ts`.

### B3 — `src/composables/usePollDetail.ts`
- [ ] `QuestionDraft` + `allowNote?: boolean` (line 54–64); new
      `DateAnswerDraft { optionId; yesNo; note? }`; `AnswerDraft` + `note?` +
      `dateAnswers?: DateAnswerDraft[]` (lines 71–77).
- [ ] `toQuestionInput` + `allowNote: q.allowNote ?? false` (lines 81–91); `toAnswerInput` +
      `note`, `dateAnswers` mapping (lines 98–104); `attributed` answers map `note`
      (lines 157–166).
- [ ] Barrel check: `src/index.ts` already exports `usePollDetail` — new view types export
      with it; verify `DateAnswerDraft` reaches the app import site.

---

## Phase C — tenant-app UI

### C1 — `PollQuestionEditor.vue` (192 lines)
- [ ] Type select gains `Date list (yes/no per date)` → `'DATE_YES_NO'`.
- [ ] `allow_note` `USwitch` on every question ("Let respondents add a note"); flipping type to
      `DATE_YES_NO` defaults it **on** (local state only until saved).
- [ ] `DATE_YES_NO` mode: hide `max_selections`/`allow_other`/`collect_datetime`/`context_at`
      controls; option editor becomes a date-list editor — "Add date" datetime picker
      (`candidateAt` required, `label` optional override), rows removable/reorderable
      (existing upsert/delete-option emits carry it — no new emits).

### C2 — `PollResponseForm.vue` (180 lines)
- [ ] `DATE_YES_NO` block: one row per option — formatted `candidateAt` (or `label` override),
      Yes/No control, and (when `allowNote`) a compact note `UInput`; builds
      `dateAnswers: [{ optionId, yesNo, note }]`; unanswered dates emit nothing.
- [ ] `allowNote` on `YES_NO`/`MULTIPLE_CHOICE`: "Add a note" `UInput` → `note`.
- [ ] Pre-fill from `myResponse.answers` (`optionId`+`yesNo`+`note` rows for date questions).

### C3 — `PollResults.vue` (126 lines) → per-question inline collapsible
- [ ] Re-shape to render for **one question**: props `question`, `rows: PollQuestionResult[]`
      (pre-filtered by `questionId`), `attributed` (pre-filtered), `visibility`. Collapsed
      one-line summary (`UCollapsible`): yes/no "5 yes · 2 no (N responses)" · mc "Leading:
      <top>" · date "Best date: <top candidateAt>". Expanded: existing tally bars; date =
      per-date yes/no bars + winning-date highlight; attributed table includes `note` text
      (aggregate never shows names/notes).

### C4 — `[id].vue` page layout (274 lines)
- [ ] Draft: single column; **remove the Discussion card from draft** (render only when
      `!isDraft` — D14). Editor card unchanged otherwise.
- [ ] Published: two-column `md+` grid (left = answer card with `PollResults` inline per
      question; right = Discussion card), stacking below `md` (UC5). Widen the page wrapper to
      `max-w-5xl mx-auto` when published (two columns don't fit 3xl; UC12 hub width).
- [ ] Delete the standalone Results card (lines 237–250); keep the `HIDDEN` non-admin notice
      as a small inline alert near the form header.
- [ ] `expandedResults` local state (collapsed by default).

### C5 — gate
- [ ] `pnpm build` green (13/13). No `$fetch`/`useFetch`/REST paths introduced (R1/R17).

---

## Phase D — verify (read-only; matches README Phase 9)
- [ ] Date-list poll end-to-end: create → add dates → open → two members answer yes/no +
      notes → per-date tallies + winning date; notes visible only attributed/admin/own.
- [ ] `allow_note` on a plain yes_no question round-trips.
- [ ] Draft shows no discussion; published shows two columns with collapsed→expandable
      results; `HIDDEN` non-admin sees no results sections.
- [ ] Existing yes/no + multiple-choice polls still answer/aggregate correctly (regression:
      the mc results arm now excludes date options).

## Docs to update when this ships (R21)
- Poll spec files: flip the "⚠ improvements round (Draft)" status blocks to Implemented; check
  off README Phases 7–9.
- `.claude/skills/fnb-stack-spec/SKILL.md` Implemented Modules `tools/poll` row: mention the
  date-list type + notes.
