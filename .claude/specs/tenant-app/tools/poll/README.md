# tools/poll — Tenant Polls (Spec Index)

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this README>` — the
> implementor derives the `.claude/issues/` plan file (R23) from the task list below, then executes
> it.

## Status
**Implemented (Phases 1–5, 2026-07-23)** — `db/fnb-poll` + permissions/nav + graphql-client-api
(codegen against the live schema) + tenant-app pages/components are built and **`pnpm build` is
green (13/13)**. Verified: DB smoke test (create → questions/options → open → submit → results,
rolled back), GraphQL introspection of all 11 mutations + query fields, read-only post-rebuild DB
checks. **Phase 6 (OTP deep-link share) is deferred — gated on `.claude/specs/otp-login/`
shipping** (only the `poll` `resolveUrnRoute` entry + the share buttons remain). This directive
stays as the entry point for that follow-on.

sqitch numbers assigned: `00000000011100`–`011130`. `poll_fn.question_result` → GraphQL
`QuestionResult`. Nav icon `i-lucide-vote` (verified present, lucide 1.2.102).

**Improvements round (2026-07-23) — Implemented same day (Phases 7–9 below, `pnpm build` 13/13
green, rolled-back DB smoke test: per-date tallies, note visibility per results mode, all three
new guard exceptions):**
1. **`date_yes_no` question type** — a list of dates, yes/no per date, optional per-date note
   (D12); 2. **`allow_note` per question** + `answer.note` (D13); 3. **published-page layout** —
   two columns: questions/answers with per-question collapsed-but-expandable results on the left,
   discussion on the right (D15); 4. **no discussion while drafting** (D14). DB deltas are
   in-place edits to the `fnb-poll` deploy files + rebuild (D16, `_shared.data.md` §2.1).

## Purpose
Let any active member of a tenant **conduct polls across all active members of that tenant**. A
poll is a URN-registered entity (`poll.poll`, like `todo.todo`) holding an ordered **list of
questions**; each question is either:

- **Yes/No** — optionally carrying an authored date/time (`context_at`, "Are you free on …?") and
  optionally asking the respondent to supply their own date/time.
- **Multiple choice** — single- or multi-select (per-question `max_selections`), an optional
  free-text **Other**, options that may each carry an authored **candidate date/time**
  (`candidate_at`, scheduling-poll style), and optionally a respondent-supplied date/time.

Every stored date/time is a real `timestamptz` ("stored as such, used later"). Members answer and
**may change only their own answers**; a poll optionally carries a **discussion topic** (todo
pattern, by subject URN); and a poll is shareable via the **same OTP deep-link login as todo**.

## Locked decisions

| # | Decision | Why |
|---|---|---|
| D1 | **URN entity** — `poll.poll` registers via `res_fn.register_resource(id, tenant, 'poll', 'poll', resident)`; generated `urn` col + deferred FK to `res.resource(id)`; v7 PK | House convention for registered business tables (`_shared.data.md` §4.1); enables discussion + OTP by URN |
| D2 | **Date/time = both authored and respondent-supplied** (user choice) | `question.context_at` (authored, whole-question) + `option.candidate_at` (authored, per-choice / scheduling) + `answer.answer_at` (respondent, gated by `collect_datetime`). All nullable — simple polls ignore them |
| D3 | **Choice mode = configurable per question** (user choice) | `question.max_selections`: 1 = single (radio), N = up to N, null = unlimited (checkboxes). `allow_other` adds a free-text Other |
| D4 | **Creation = any active member** (user choice, todo-style) | New `p:poll` in `app-user`; `p:poll-admin` in admin tiers. The **creator** is that poll's admin (or any `p:poll-admin`) |
| D5 | **Results visibility = per-poll admin choice** (user choice) | `results_visibility` enum `hidden`/`aggregate`/`attributed`; enforced by RLS (raw rows) + a DEFINER `get_poll_results` (counts). Creator/admin always see full |
| D6 | **Two admin toggles** from the brief | `allow_change_after_submit` (lock answers after submit) + `results_visibility` (the "see others" option, three-way) |
| D7 | **Answer model**: one `poll.response` per (poll, member) + one `poll.answer` row per selected value | Uniform across yes/no, single/multi-select, Other; unique `(poll_id, respondent)` = one response each; "change only your answers" = own-write RLS |
| D8 | **Lifecycle** `draft → open → closed`; structure frozen after `draft` | Author builds in draft; answers only while `open`; freezing questions/options after open protects existing answers; optional `closes_at` |
| D9 | **Discussion = reuse** the todo/subject-URN pattern (`usePollMsg`, `PollMsg` copies of the todo ones) | Zero new DDL/graphql — `msg.topic.subject_urn = poll.urn` (`stacking-v2`); requires `p:discussions` |
| D10 | **OTP = reuse** otp-login (`createDeepLink`/`sendDeepLink` + a `poll` `resolveUrnRoute` entry) | "Same OTP options as todo"; the otp-login spec named polls as its next target. **Gated on otp-login shipping** |
| D11 | Lives under **Tools** at `/tenant/tools/poll` (parallel to todo); new sqitch package **`fnb-poll`** after `fnb-res`/`fnb-app` | Consistency with the todo module; promotable to a top-level nav module later |
| D12 | **`date_yes_no` = a real question type** (user choice 2026-07-23): options are the dates (`candidate_at` required, `label` optional), answer = one row per date (`option_id` + `yes_no` + optional `note`) | Doodle-style availability poll as one compact question; results reuse the shipped `question_result` shape (per-option yes/no counts) — rejected the bulk-generated-yes/no-questions alternative (no marker that a poll IS a date poll; clunky N-question rendering) |
| D13 | **`allow_note` generalized per question** (user choice 2026-07-23): `question.allow_note` + `answer.note`, any type; editor defaults it ON for `date_yes_no`. Notes are **attributed-only** — never in aggregate results | Same DDL cost as date-only, more mileage; free-text notes are identifying, so `get_poll_results` never returns them |
| D14 | **Discussion hidden during `draft`** (user directive 2026-07-23) — panel + toggle not rendered until published | Discussion belongs to the published conversation, not authoring |
| D15 | **Published layout = fixed two-column** (user directive 2026-07-23): left = questions/answers with per-question **collapsed, expandable** inline results; right = discussion (always visible, replaces the localStorage rail). Mobile stacks | Answers + results + discussion visible together without mode switching; results summary stays scannable |
| D16 | **DB deltas via in-place edits** to the four `fnb-poll` deploy files + USER REBUILD GATE (no new sqitch changes) | Package shipped the same day, no production data; matches the house seed-edit pattern (`_shared.data.md` §2.1) |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | this index |
| `_shared.data.md` | permissions, `fnb-poll` package, enums, tables, RLS, `poll_fn`/`poll_api` functions, fnb-types, discussion + OTP reuse contracts |
| `index.ui.md` | `/tenant/tools/poll` list page — layout, components, badges, interactions |
| `index.data.md` | list page — `SearchPolls` / `CreatePoll`, `usePollList` |
| `[id].ui.md` | detail page — the three modes (draft editor · answer form · results) + discussion + share |
| `[id].data.md` | detail page — `PollById` / `PollResults` + all mutations, `usePollDetail`, `usePollMsg`, OTP |

## Implementation Task List (phased, build order)

### Phase 1 — DB package `fnb-poll` (`fnb-db-designer` + `sqitch-expert`)
- [ ] New sqitch package `fnb-poll`; add to `DEPLOY_PACKAGES` (`.env` + `.env.example`) after
      `fnb-todo`.
- [ ] `poll` schema: enums (`poll_status`, `question_type`, `results_visibility`) + tables
      (`poll`, `question`, `option`, `response`, `answer`) with URN column/FK on `poll.poll`
      (`_shared.data.md` §3–§4).
- [ ] `poll_fn` composite input types (`question_input`, `option_input`, `answer_input`,
      `search_polls_options`, `question_result`) (§6.1).
- [ ] `poll_fn`/`poll_api` functions (two-layer R8): create/update/set-options/set-status/delete
      poll; upsert/delete question + option (draft-gated); `save_response`/`submit_response`
      (open + not-locked + validation); `search_polls`; `get_poll_results` (DEFINER, visibility-
      gated) (§6.2).
- [ ] Policies: schema grants + RLS. Tenant fence on structure; own-write + attributed-read on
      `response`/`answer` (§5).

### Phase 2 — cross-package in-place edits (⚠ USER REBUILD GATE — do not rebuild yourself)
- [ ] `db/fnb-app/.../00000000010240_app_fn.sql` `install_anchor_application`: add `p:poll` to
      `app-user`; `p:poll` + `p:poll-admin` to `app-admin`/`-super`/`-support`.
- [ ] Same file: nav — add a `polls` tool to the `tools` module
      (`'{"p:app-user","p:app-admin","p:poll"}'`, icon `i-lucide-vote` — **verify UC11**,
      `/tenant/tools/poll`).
- [ ] `db/fnb-res/.../00000000011000_res.sql`: add `,('poll', 'p:poll')` to the
      `res.module_permission` seed.
- [ ] **Stop and ask the user to rebuild** (`pnpm env-rebuild`); verify read-only afterward.

### Phase 3 — GraphQL client (`graphql-client-api`, codegen against live schema)
- [ ] `graphql/poll/` fragments + queries (`searchPolls`, `pollById`, `pollResults`,
      `pollAttributedResponses`) + mutations (create/update/setOptions/setStatus/delete poll,
      upsert/delete question + option, save/submit response). Re-run codegen.
- [ ] fnb-types `poll.ts` (§7) + barrel; mappers if needed.
- [ ] Composables `usePollList`, `usePollDetail`, `usePollMsg` (source + tenant-app re-exports).

### Phase 4 — tenant-app pages + components
- [ ] Pages `app/pages/tenant/tools/poll/index.vue` + `[id].vue`.
- [ ] Components `poll/PollList`, `PollListSmall`, `PollModal`, `PollDetail`, `PollDetailSmall`,
      `PollQuestionEditor`, `PollResponseForm`, `PollResults`, `PollSettingsModal`, `PollMsg`.

### Phase 5 — verify
- [ ] Fresh rebuild → create a poll (yes/no + multi-choice-with-candidate-times + Other) → open →
      answer as two members → toggle each `results_visibility` and confirm hidden/aggregate/
      attributed behavior → lock-after-submit works → close → discussion works. `pnpm build` green.

### Phase 6 — OTP deep-link share (**gated on `.claude/specs/otp-login/` shipping**)
- [ ] Add `poll: (id) => '/tenant/tools/poll/${id}'` to
      `apps/auth-app/server/utils/urn-route.ts` (safe one-liner; can land early).
- [ ] Wire "Copy quick-login link" + "Send to residents" on the detail page via `useDeepLink`
      (reuse the todo surface, subject URN = `poll.urn`).

### Phase 7 — improvements round: DB deltas (in-place edits, D16 — ⚠ USER REBUILD GATE)
- [x] `00000000011100_poll.sql`: `question_type` enum + `'date_yes_no'`; `question.allow_note`;
      `option.label` → nullable + the two checks; `answer.note` (`_shared.data.md` §3–§4).
- [x] `00000000011110_poll_fn_types.sql`: new `poll_fn.date_answer_input`; `question_input` +
      `allow_note`; `answer_input` + `note` + `date_answers` (§6.1).
- [x] `00000000011120_poll_fn.sql`: `upsert_question`/`upsert_option` date-type guards;
      `save_response`/`submit_response` date/note validation + write pattern; `get_poll_results`
      per-date rows, notes never returned (§6.2).
- [x] **Stop and ask the user to rebuild** (`pnpm env-rebuild`); verify read-only afterward.

### Phase 8 — improvements round: client + UI
- [x] Re-run codegen; extend `PollById` fragments (`allowNote`, `note`); fnb-types deltas
      (`DATE_YES_NO`, `allowNote`, `note`, nullable `label`) (§7; `[id].data.md`).
- [x] `PollQuestionEditor`: `Date list` type + date-list editor; `allow_note` switch (default ON
      for date type) (`[id].ui.md` Mode A).
- [x] `PollResponseForm`: per-date yes/no + note grid; note inputs on `allowNote` questions
      (`[id].ui.md` Mode B).
- [x] `PollDetail`/`PollDetailSmall` + `[id].vue`: draft = single column, **no discussion**;
      published = two-column (Q&A left, `PollMsg` right, rail toggle removed); `PollResults`
      becomes the per-question collapsed/expandable inline summary (`[id].ui.md` Layout/Mode C).

### Phase 9 — improvements round: verify
- [x] Rebuild → date-list poll end-to-end (create → add dates → open → two members answer
      yes/no + notes → per-date tallies + winning date; notes visible only attributed/admin) →
      `allow_note` on a yes_no question → draft shows no discussion → published two-column with
      collapsed/expandable results. `pnpm build` green.

## Docs to update when this ships (R21)
- `res.module_permission` list in `urn-registry/_shared.data.md` (add `poll`).
- `otp-login` README — move "Group polls" from the deferred-ideas list to implemented; note the
  `poll` `resolveUrnRoute` entry.
- `.claude/skills/fnb-stack-spec/SKILL.md` "Implemented Modules" table — add `poll` when built.
- CLAUDE.md db package list + `fnb-db-designer` package count (twelve → thirteen).

## Remaining Open Questions
Consolidated in `_shared.data.md` §10:
- [ ] Exact sqitch file numbers for `fnb-poll`.
- [ ] `poll_fn.question_result` shape + setof-composite inflection (postgraphile-5-expert).
- [ ] `get_poll_results` hidden/non-admin behavior (own-only vs raise) — leaning own-only.
- [ ] Confirm `i-lucide-vote` exists (UC11); fallback `i-lucide-list-checks`.

## Considered & rejected
- **Yes/No as two seeded options** (uniform with multiple_choice) — rejected: a boolean
  `answer.yes_no` is simpler and matches "simple yes/no"; options table stays multiple_choice-only.
- **Separately URN-registering questions/options/answers** — rejected: only the poll is the
  shareable/discussable subject (todo registers only the todo, not subtasks).
- **Enforcing aggregate-vs-attributed purely via RLS** — rejected: if a member can SELECT another's
  row, identity leaks; so `aggregate` keeps raw rows hidden and exposes counts only through the
  DEFINER `get_poll_results`.
- **Attachments on polls (todo-style)** — deferred: not in the brief; the discussion covers the
  collaboration need. Easy to add later via `useSubjectAssets(poll.urn)` (same pattern as todo).
- **A top-level "Polls" nav module** — deferred: placed under Tools beside todo for consistency;
  promotable later (D11).
- **Editing questions after a poll opens** — rejected: freezes at `draft→open` to avoid
  invalidating submitted answers; clone-to-new-draft is the path to revise a live poll (future).
