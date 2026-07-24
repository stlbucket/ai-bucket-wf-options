# tools/poll — Shared Data (schema · permissions · RLS · reuse contracts)

## Status
Implemented — GraphQL (2026-07-23; status trued up by the recurring spec/code reconciliation).
The former open items are resolved: sqitch numbers `00000000011100`–`00000000011130`, nav icon
`i-lucide-vote` (verified, UC11), and the `question_result` composite shape below matches the
shipped DDL. See `README.md` for verification + the deferred OTP phase.

**2026-07-23 improvements round — Implemented same day (README Phases 7–9):** adds the
**`date_yes_no` question type** (a list of dates, yes/no per date, optional per-date note) and a
generalized per-question **`allow_note`** toggle with a per-answer **`note`**. DB deltas are
marked **`NEW`** in §3–§7 below; migration mechanics in §2.1. The published-page layout changes
(two-column, draft hides discussion) are UI-only — see `[id].ui.md`.

This file is the single source of truth for the `poll` module's types, DB schema, permission
model, and the contracts it **reuses** from three existing subsystems:

- **URN registry** (`.claude/specs/urn-registry/`) — the poll is a registered business entity
  (`res_fn.register_resource(id, tenant, 'poll', 'poll', resident)`), exactly like `todo.todo`.
- **Discussion by subject URN** (`.claude/specs/urn-registry/stacking-v2.data.md`) — the optional
  discussion is a `msg.topic` whose `subject_urn = poll.urn`; consumed via a `usePollMsg(pollUrn)`
  clone of `useTodoMsg` (no poll-side DDL).
- **OTP deep-link login** (`.claude/specs/otp-login/`) — polls are the module the otp-login spec
  named as the next `resolveUrnRoute` target (D7 / "The what-else-would-help ideas"). Polls add
  the `poll` route entry + reuse the `createDeepLink` / `sendDeepLink` share surface. **This is the
  "same OTP options as todo."**

---

## 1. Permission model

Two new permission keys, mirroring `todo` / `todo-admin`:

| Key | Granted to (license types) | Grants |
|---|---|---|
| `p:poll` | `app-user`, `app-admin`, `app-admin-super`, `app-admin-support` | create polls, answer polls, see own answers |
| `p:poll-admin` | `app-admin`, `app-admin-super`, `app-admin-support` | manage **any** poll in the tenant, always see full attributed results, open/close others' polls |

Any active member can **create** a poll (todo-style, user decision). The **creator** is that
poll's admin — the per-poll admin toggles (open/close, results visibility, lock-after-submit) are
available to the creator **or** any holder of `p:poll-admin`.

Discussion reuses the existing `p:discussions` key (no new discussion permission).

### 1.1 Where the keys are registered (in-place edits, `db/fnb-app`)
`db/fnb-app/deploy/00000000010240_app_fn.sql` → `install_anchor_application()` license_type_info
array — append `p:poll` to `app-user`, and `p:poll` + `p:poll-admin` to `app-admin`,
`app-admin-super`, `app-admin-support` (the same rows that already list `p:todo` / `p:todo-admin`,
lines ~229–247). These are **in-place edits to a seed function** — invisible to `sqitch deploy`,
reached only by a full rebuild (USER REBUILD GATE — do not rebuild yourself, CLAUDE.md).

### 1.2 Registry visibility (in-place edit, `db/fnb-res`)
`db/fnb-res/deploy/00000000011000_res.sql` → the `res.module_permission` seed insert (line ~48):
add `,('poll', 'p:poll')`. This scopes registry existence/type leaks for `poll` URNs to
`p:poll` holders (same shape as `('todo','p:todo')`).

---

## 2. Package & schema layout

New sqitch package **`fnb-poll`** (parallels `fnb-todo`). Trio schemas `poll` / `poll_fn` /
`poll_api`. Deploy order: **after `fnb-res`** (URN registry — hard dependency: `build_urn`,
`register_resource`, the `res.resource(urn)`/`(id)` FK targets) **and after `fnb-app`** (tenant /
resident / permissions). No build-order dependency on `fnb-msg` — the discussion linkage is
`msg.topic.subject_urn → res.resource(urn)`, and `poll.urn` lives in `res.resource`; poll never
references the `msg` schema. Place it right after `fnb-todo` in `DEPLOY_PACKAGES` (`.env` +
`.env.example`).

Deploy files (numbers illustrative — `sqitch-expert` assigns the final block, a fresh range after
`fnb-todo`'s 10450–10480):

| File | Contents |
|---|---|
| `…_poll.sql` | `poll` schema, enums, tables, indexes |
| `…_poll_fn_types.sql` | `poll_fn` composite input types |
| `…_poll_fn.sql` | `poll` / `poll_fn` / `poll_api` functions |
| `…_poll_policies.sql` | schema grants + RLS enable + policies |

### 2.1 Migration mechanics for the 2026-07-23 improvements (NEW)

The `fnb-poll` package shipped the same day as this improvement round — there is **no production
data**. The DB deltas (enum value, `question.allow_note`, `answer.note`, `option.label`
nullability, `answer_input`/`date_answer_input` composites, function bodies) land as **in-place
edits to the four existing deploy files** (`00000000011100`–`011130`), reached only by a full
rebuild — the same pattern as the fnb-app/fnb-res seed edits (**USER REBUILD GATE — do not
rebuild yourself**). No new sqitch change files; `sqitch-expert` may override to a rework if the
plan integrity ever demands it (it shouldn't at this dev stage).

---

## 3. Enums (`poll` schema)

```sql
create type poll.poll_status as enum ('draft', 'open', 'closed');
-- draft  : author is building it; not answerable; not shown to members
-- open   : accepting responses
-- closed : read-only; no more writes (manual close or closes_at passed)

create type poll.question_type as enum ('yes_no', 'multiple_choice', 'date_yes_no');
-- date_yes_no (NEW 2026-07-23): the question holds a LIST OF DATES as its option rows
--   (option.candidate_at required, label optional); the respondent answers yes/no PER DATE and
--   may attach a per-date note (question.allow_note defaults ON for this type in the editor).
--   context_at / collect_datetime / max_selections / allow_other do NOT apply to date_yes_no.

create type poll.results_visibility as enum ('hidden', 'aggregate', 'attributed');
-- hidden     : a member sees only their OWN answers
-- aggregate  : members see counts/percentages, never who voted for what
-- attributed : members see who answered what (answers tagged with displayName)
-- (the poll creator / p:poll-admin ALWAYS sees full attributed results regardless)
```

---

## 4. Tables

### 4.1 `poll.poll` — the URN entity

```sql
create table poll.poll (
  id uuid not null default res_fn.uuid_generate_v7() primary key
  ,tenant_id uuid not null references app.tenant(id)
  ,created_by_resident_urn text not null references res.resource(urn)
  ,created_at timestamptz not null default current_timestamp
  ,updated_at timestamptz not null default current_timestamp
  ,title citext not null
  ,description citext null
  ,status poll.poll_status not null default 'draft'
  ,closes_at timestamptz null                         -- optional auto-close moment
  ,allow_change_after_submit boolean not null default true   -- admin option
  ,results_visibility poll.results_visibility not null default 'hidden'  -- admin option
  ,check (char_length(title) >= 3)
  ,urn text not null
     generated always as (res_fn.build_urn(tenant_id, 'poll', 'poll', id)) stored
  ,constraint uq_poll_urn unique (urn)
  ,constraint fk_poll_resource foreign key (id) references res.resource(id)
     deferrable initially deferred
);
create index idx_poll_poll_tenant_id on poll.poll(tenant_id);
create index idx_poll_poll_created_by on poll.poll(created_by_resident_urn);
create index idx_poll_poll_status on poll.poll(status);
```

- `allow_change_after_submit = false` → once a member submits, their answers are locked (the two
  admin options from the brief: *can/cannot change answers after submission*).
- `results_visibility` is the *users can see others' answers* admin option, expanded to the
  per-poll three-way choice (user decision).

### 4.2 `poll.question` — ordered questions in a poll (the "list of questions")

```sql
create table poll.question (
  id uuid not null default res_fn.uuid_generate_v7() primary key
  ,poll_id uuid not null references poll.poll(id) on delete cascade
  ,ordinal integer not null
  ,question_type poll.question_type not null
  ,prompt citext not null
  ,required boolean not null default true
  -- multiple_choice only: 1 = single-select (radio); N (>1) = up to N; null = unlimited multi
  ,max_selections integer null
  ,allow_other boolean not null default false      -- optional free-text "Other" choice
  ,allow_note boolean not null default false       -- NEW: respondent may attach a free-text note
                                                   -- to their answer (any type; editor defaults
                                                   -- it ON for date_yes_no)
  ,collect_datetime boolean not null default false -- ask the RESPONDENT to supply a date/time
  ,context_at timestamptz null                     -- AUTHORED date/time describing the question
                                                   -- (e.g. yes/no "Are you free on <context_at>?")
  ,check (char_length(prompt) >= 1)
  ,check (max_selections is null or max_selections >= 1)
);
create index idx_poll_question_poll_id on poll.question(poll_id);
create unique index uq_poll_question_ordinal on poll.question(poll_id, ordinal);
```

The date/time "both" decision is realized across three optional, nullable slots (a simple poll
ignores all three):

| Aspect | Where | Column |
|---|---|---|
| Authored, whole-question (yes/no "…on this date?") | `poll.question` | `context_at` |
| Authored, per-choice (scheduling poll — each option is a candidate time) | `poll.option` | `candidate_at` |
| Respondent-supplied ("Yes — and I'm free at ___") | `poll.answer` | `answer_at` (gated by `question.collect_datetime`) |

### 4.3 `poll.option` — choices for a `multiple_choice` question / dates for a `date_yes_no` one

```sql
create table poll.option (
  id uuid not null default res_fn.uuid_generate_v7() primary key
  ,question_id uuid not null references poll.question(id) on delete cascade
  ,ordinal integer not null
  ,label citext null               -- CHANGED (was not null): optional for date_yes_no options,
                                   -- where the formatted candidate_at is the display
  ,candidate_at timestamptz null   -- AUTHORED candidate date/time (scheduling poll / the DATE
                                   -- of a date_yes_no row — required for that type, fn-enforced)
  ,check (label is not null or candidate_at is not null)
  ,check (label is null or char_length(label) >= 1)
);
create index idx_poll_option_question_id on poll.option(question_id);
create unique index uq_poll_option_ordinal on poll.option(question_id, ordinal);
```

`yes_no` questions carry **no** option rows — their answer is the boolean `poll.answer.yes_no`.
`multiple_choice` questions have selectable options. **`date_yes_no` questions (NEW) use option
rows as their date list**: `candidate_at` is required (enforced in `upsert_option`, not DDL —
the table is shared), `label` is an optional display override. The optional "Other" is
`question.allow_other` (not a stored option row) — a respondent's Other answer lands in
`poll.answer.other_text` (multiple_choice only).

### 4.4 `poll.response` — one submission envelope per (poll, member)

```sql
create table poll.response (
  id uuid not null default res_fn.uuid_generate_v7() primary key
  ,poll_id uuid not null references poll.poll(id) on delete cascade
  ,tenant_id uuid not null references app.tenant(id)      -- = poll.tenant_id (RLS convenience)
  ,respondent_resident_urn text not null references res.resource(urn)
  ,created_at timestamptz not null default current_timestamp
  ,updated_at timestamptz not null default current_timestamp
  ,submitted_at timestamptz null    -- null = in progress; set on submit (lock point)
  ,constraint uq_response_poll_respondent unique (poll_id, respondent_resident_urn)
);
create index idx_poll_response_poll_id on poll.response(poll_id);
create index idx_poll_response_respondent on poll.response(respondent_resident_urn);
```

"Across all active members of any tenant": eligibility is *any* active resident of the poll's
tenant (`p:poll`) — no explicit invite list. One response row per member per poll (unique).

### 4.5 `poll.answer` — one row per selected value

```sql
create table poll.answer (
  id uuid not null default res_fn.uuid_generate_v7() primary key
  ,response_id uuid not null references poll.response(id) on delete cascade
  ,question_id uuid not null references poll.question(id) on delete cascade
  -- denormalized from response for simple RLS policies + aggregation:
  ,poll_id uuid not null references poll.poll(id) on delete cascade
  ,tenant_id uuid not null references app.tenant(id)
  ,respondent_resident_urn text not null references res.resource(urn)
  -- the value (exactly one shape is populated per row):
  ,option_id uuid null references poll.option(id) on delete cascade  -- multiple_choice selection
                                                                     -- OR the date_yes_no date row
  ,yes_no boolean null                                               -- yes_no / per-date answer
  ,other_text citext null                                            -- the "Other" free text
  ,note citext null                                                  -- NEW: respondent's free-text
                                                                     -- note (question.allow_note)
  ,answer_at timestamptz null                                        -- respondent-supplied date/time
  ,created_at timestamptz not null default current_timestamp
);
create index idx_poll_answer_response_id on poll.answer(response_id);
create index idx_poll_answer_question_id on poll.answer(question_id);
create index idx_poll_answer_poll_id on poll.answer(poll_id);
create index idx_poll_answer_option_id on poll.answer(option_id);
```

Answer shapes:
- **yes_no** → one row, `yes_no` set (+ optional `answer_at`).
- **multiple_choice, single-select** → one row, `option_id` set.
- **multiple_choice, multi-select** → up to `max_selections` rows, each with an `option_id`.
- **Other** → one row, `other_text` set (`option_id` null), when `question.allow_other`.
- **date_yes_no (NEW)** → **one row per answered date**: `option_id` (the date row) + `yes_no`
  set, plus optional `note` (per-date note). Unanswered dates simply have no row.
- **`note` (NEW)** may accompany any row when `question.allow_note` — for yes_no it rides the
  single answer row; for multiple_choice it rides the first written row (one note per question,
  per respondent); for date_yes_no it is genuinely per-date.

**Notes visibility rule (NEW):** notes are free text and inherently identifying, so they are
**never** returned by the aggregate results function (§6 `get_poll_results`). Notes surface only
through raw-row RLS — own rows always; others' rows only under `attributed` visibility or
creator/`p:poll-admin` (§5, unchanged policies — `note` is just a column on `poll.answer`).

Only `poll.poll` is URN-registered; questions/options/response/answer are child rows (like todo
subtasks are not separately registered — only the todo is). Deleting a poll cascades to all
children; `poll_fn.delete_poll` also calls `res_fn.archive_resource(poll_id)`.

---

## 5. RLS policies (`…_poll_policies.sql`)

Schema grants follow the house pattern (`grant all on all tables/routines/sequences in schema
poll/poll_fn/poll_api to anon, authenticated, service_role`; `alter default privileges …`) — see
`db/fnb-todo/deploy/00000000010480_todo_policies.sql`. RLS then does the real restriction.

**Poll structure — tenant-readable, function-gated writes:**

```sql
-- poll.poll, poll.question, poll.option  (questions/options via their poll's tenant)
alter table poll.poll enable row level security;
create policy tenant_read_poll on poll.poll for select
  using (jwt.tenant_id()::uuid = tenant_id);
create policy tenant_write_poll on poll.poll for all
  using (jwt.tenant_id()::uuid = tenant_id)
  with check (jwt.tenant_id()::uuid = tenant_id);
-- (creator-or-admin gating happens in poll_api.* — see §6; RLS is the tenant fence)
```

`poll.question` / `poll.option` get the same tenant fence (their `tenant_id` is reached via
`poll_id`; denormalize `tenant_id` onto `question`/`option` OR use an `exists (… poll …)` clause —
implementor's call. Denormalizing `tenant_id` onto every table keeps all policies uniform and is
the recommended path). `draft` polls are hidden from non-admins at the **query** layer (the
`SearchPolls` composable filters `status != 'draft' OR mine`), not by RLS — a member may need to
see their own draft.

**Response / answer — own-write, visibility-scoped reads** (multiple permissive policies OR for
SELECT; only the own-policy grants writes):

```sql
alter table poll.response enable row level security;

-- own rows: full read + write (this is "users can change ONLY their answers")
create policy own_response on poll.response for all
  using (
    jwt.tenant_id()::uuid = tenant_id
    and respondent_resident_urn = (select urn from app.resident where id = jwt.resident_id())
  )
  with check (
    jwt.tenant_id()::uuid = tenant_id
    and respondent_resident_urn = (select urn from app.resident where id = jwt.resident_id())
  );

-- read others' rows ONLY when the poll is attributed, or the caller administers polls
create policy read_others_response on poll.response for select
  using (
    jwt.tenant_id()::uuid = tenant_id
    and (
      jwt.has_permission('p:poll-admin', tenant_id)
      or exists (
        select 1 from poll.poll p
        where p.id = poll_id and p.results_visibility = 'attributed'
      )
    )
  );
```

`poll.answer` gets the identical pair (own via `respondent_resident_urn`; read-others via
`results_visibility = 'attributed'` on the denormalized `poll_id`). This yields, per member:

| `results_visibility` | Non-admin member sees (raw rows) | Aggregate counts (via §6 fn) |
|---|---|---|
| `hidden` | own answers only | denied (own-only) |
| `aggregate` | own answers only | ✅ counts, no identities |
| `attributed` | everyone's answers (+ names) | ✅ counts |
| *(poll creator or `p:poll-admin`)* | everyone's answers, always | ✅ always |

The `aggregate` vs `attributed` distinction is enforced by keeping raw rows hidden under
`aggregate` while the **`poll_api.get_poll_results`** DEFINER function (§6) returns identity-free
counts — so members see numbers without ever selecting another member's row.

---

## 6. Functions (`poll_fn` / `poll_api`, two-layer R8)

All `_api` are `SECURITY INVOKER`, gate with `jwt.*`, and delegate to `_fn` (which take explicit
params, never call `jwt.*`). Mirrors `todo_api`/`todo_fn`.

### 6.1 Composite input types (`…_poll_fn_types.sql`)

```sql
create type poll_fn.question_input as (
  id uuid                 -- null = new
 ,ordinal integer
 ,question_type poll.question_type
 ,prompt citext
 ,required boolean
 ,max_selections integer
 ,allow_other boolean
 ,allow_note boolean      -- NEW
 ,collect_datetime boolean
 ,context_at timestamptz
);
create type poll_fn.option_input as (
  id uuid                 -- null = new
 ,ordinal integer
 ,label citext            -- now optional when candidate_at is set
 ,candidate_at timestamptz
);
create type poll_fn.date_answer_input as (  -- NEW: one per answered date of a date_yes_no question
  option_id uuid          -- the date row
 ,yes_no boolean
 ,note citext             -- per-date note (allow_note)
);
create type poll_fn.answer_input as (
  question_id uuid
 ,option_ids uuid[]       -- multiple_choice selections (1 for single, N for multi)
 ,yes_no boolean          -- yes_no answer
 ,other_text citext       -- the "Other" free text
 ,note citext             -- NEW: per-question note (allow_note; yes_no/multiple_choice)
 ,answer_at timestamptz   -- respondent-supplied date/time
 ,date_answers poll_fn.date_answer_input[]  -- NEW: date_yes_no per-date answers
);
```

### 6.2 API surface

| `poll_api` fn | Guard | Delegates to / does |
|---|---|---|
| `create_poll(_title, _description)` | `p:poll` | `poll_fn.create_poll(...)` — inserts a `draft` poll, `register_resource`, returns `poll.poll` |
| `update_poll(_poll_id, _title, _description, _closes_at)` | creator **or** `p:poll-admin` | edit metadata |
| `set_poll_options(_poll_id, _allow_change_after_submit, _results_visibility)` | creator or `p:poll-admin` | the two admin toggles |
| `set_poll_status(_poll_id, _status)` | creator or `p:poll-admin` | draft→open→closed transitions |
| `delete_poll(_poll_id)` | creator or `p:poll-admin` | cascade delete + `archive_resource` |
| `upsert_question(_poll_id, _q poll_fn.question_input)` | creator or `p:poll-admin`; **poll must be `draft`** | insert/update a question |
| `delete_question(_question_id)` | creator or `p:poll-admin`; `draft` | remove question |
| `upsert_option(_question_id, _o poll_fn.option_input)` | creator or `p:poll-admin`; `draft` | insert/update an option |
| `delete_option(_option_id)` | creator or `p:poll-admin`; `draft` | remove option |
| `save_response(_poll_id, _answers poll_fn.answer_input[])` | `p:poll`; poll `open`; not-locked | upsert the caller's own response + answers, leave `submitted_at` untouched (autosave / draft answers) |
| `submit_response(_poll_id, _answers poll_fn.answer_input[])` | `p:poll`; poll `open`; not-locked | save + set `submitted_at = now()` |
| `search_polls(_options poll_fn.search_polls_options)` | `p:poll` | setof `poll.poll` for the list page |
| `get_poll_results(_poll_id)` | member of tenant; visibility-gated | setof `poll_fn.question_result` — identity-free counts |

**Structure-edit lock:** question/option mutations require `status = 'draft'` — a poll's shape is
frozen once it opens (so answers can't be invalidated). Metadata (`title`/`description`/
`closes_at`) and the admin toggles may change any time.

**Answer-write guards** (`save_response`/`submit_response`):
- poll `status = 'open'` (raise `30000`/a poll-closed code otherwise);
- the response is the caller's own (resolved from `jwt.resident_id()` → `app.resident.urn`);
- if `allow_change_after_submit = false` **and** an existing `poll.response.submitted_at is not
  null` → raise a "answers locked" exception;
- validate each answer against its question (yes_no ⇒ `yes_no` set; multiple_choice ⇒
  `option_ids` within the question's options and count ≤ `max_selections`; Other only when
  `allow_other`; `answer_at` only when `collect_datetime`; **NEW:** `note` / `date_answers[].note`
  only when `allow_note`; date_yes_no ⇒ `date_answers` only, each `option_id` within the
  question's options, `yes_no` set per entry, no duplicate `option_id`s — and conversely
  `date_answers` is rejected on non-date questions).
- write pattern: delete the response's existing `poll.answer` rows for the submitted questions,
  re-insert from `_answers` (simplest correct upsert for the variable-cardinality multi-select
  and the per-date date_yes_no rows).

**Structure-edit guards for `date_yes_no` (NEW, in `upsert_question`/`upsert_option`):**
`upsert_option` requires `candidate_at is not null` when the question is `date_yes_no` (and keeps
requiring a non-empty `label` for `multiple_choice`); `upsert_question` ignores/nulls
`max_selections`, `allow_other`, `collect_datetime`, `context_at` for `date_yes_no`.

**`get_poll_results`** (`stable security definer`, `search_path` pinned): resolves the poll,
asserts `jwt.tenant_id() = poll.tenant_id`, then:
- if caller is creator or `p:poll-admin`, **or** `results_visibility in ('aggregate','attributed')`
  → return per-question / per-option counts (yes/no tallies, option vote counts, Other count,
  candidate_at winner), plus `respondent_count`;
- else (`hidden`, non-admin) → return only the caller's own contribution (or raise — implementor's
  call; UI treats "hidden" as "results not shared").

`poll_fn.question_result` composite (as shipped, `00000000011110_poll_fn_types.sql`):
`question_id uuid, option_id uuid, label citext, candidate_at timestamptz, vote_count integer,
yes_count integer, no_count integer, other_count integer, respondent_count integer`.
PostGraphile inflects the setof-composite return into GraphQL type `QuestionResult`
(`getPollResultsList` via `poll_api.get_poll_results`).

**`date_yes_no` results (NEW — no composite shape change):** one `question_result` row **per date
option** with `option_id`/`label`/`candidate_at` set and `yes_count`/`no_count` filled per date
(`vote_count` = yes_count + no_count for that date). The existing composite already carries every
needed column. Notes are **never** included (see §4.5 visibility rule).

---

## 7. TypeScript types (`@function-bucket/fnb-types` — R3)

Entity/view types are added to `packages/fnb-types` (the shared vocabulary; UPPERCASE enum
mirrors, `Date` timestamps). Generated codegen types stay internal to `graphql-client-api`,
bridged by mappers.

```ts
// packages/fnb-types/src/poll.ts (barrel-export from src/index.ts)
export type PollStatus = 'DRAFT' | 'OPEN' | 'CLOSED'
export type QuestionType = 'YES_NO' | 'MULTIPLE_CHOICE' | 'DATE_YES_NO' // DATE_YES_NO is NEW
export type ResultsVisibility = 'HIDDEN' | 'AGGREGATE' | 'ATTRIBUTED'

export interface Poll {
  id: string
  urn: string
  tenantId: string
  title: string
  description: string | null
  status: PollStatus
  closesAt: Date | null
  allowChangeAfterSubmit: boolean
  resultsVisibility: ResultsVisibility
  createdByResidentUrn: string
  createdAt: Date
  updatedAt: Date
}
export interface PollQuestion {
  id: string
  pollId: string
  ordinal: number
  questionType: QuestionType
  prompt: string
  required: boolean
  maxSelections: number | null
  allowOther: boolean
  allowNote: boolean // NEW
  collectDatetime: boolean
  contextAt: Date | null
  options: PollOption[]
}
export interface PollOption {
  id: string
  questionId: string
  ordinal: number
  label: string | null // CHANGED: null on date_yes_no rows displayed via candidateAt
  candidateAt: Date | null
}
export interface PollAnswer {
  id: string
  questionId: string
  optionId: string | null
  yesNo: boolean | null
  otherText: string | null
  note: string | null // NEW
  answerAt: Date | null
}
export interface PollResponse {
  id: string
  pollId: string
  respondentResidentUrn: string
  submittedAt: Date | null
  answers: PollAnswer[]
}
```

Composable **view** types (list-row / detail-tree shapes derived from generated query types) live
in `packages/graphql-client-api/src/composables/` (R4) — see `index.data.md` / `[id].data.md`.

---

## 8. Discussion (reuse — no poll DDL)

The optional discussion is the todo pattern verbatim (`stacking-v2.data.md`):

- `usePollMsg(pollUrn)` — a copy of `packages/graphql-client-api/src/composables/useTodoMsg.ts`
  with the todo comment swapped for poll. Queries `DiscussionBySubject($subjectUrn: pollUrn)`,
  `startDiscussion(name, participantUrns, initialMessage)` upserts a `msg.topic` with
  `subjectUrn = poll.urn`. Re-export `apps/tenant-app/app/composables/usePollMsg.ts`.
- The panel renders storage-layer's / msg's `Msg` component with `topic.id` (the topic's own id,
  **not** the poll id — v2 stacking). Component `PollMsg.vue` = a copy of `TodoMsg.vue`.
- Requires `p:discussions` (already in `app-user`/`app-admin` bundles).

No new `.graphql` files — `discussionBySubject.graphql` + `upsertTopic` already exist. `usePollMsg`
just points them at the poll's URN.

---

## 9. OTP deep-link share (reuse — "same OTP options as todo")

The otp-login spec (`.claude/specs/otp-login/`) owns the machinery; polls plug in:

1. **URN route map** — add to `apps/auth-app/server/utils/urn-route.ts` `ROUTES`:
   ```ts
   poll: (id) => `/tenant/tools/poll/${id}`,
   ```
2. **Share surface** — the poll detail page reuses `useDeepLink` (`share-link.data.md`):
   - "Copy quick-login link" → `shareToLink(poll.urn)`
   - "Send to residents" modal → `sendDeepLink(poll.urn, residentIds, message, channels)`
   Same components/composable as the todo detail; only the subject URN changes.

**Dependency:** the otp-login spec is currently `Draft` (sequenced behind notifications SMS Phase
0/1). Polls' Phase (OTP share) is **gated on otp-login shipping** — until then the poll detail page
omits the share buttons (or they no-op). The URN-route entry is a one-line, safe addition that can
land with otp-login. See `README.md` task list Phase 6.

---

## 10. Open Questions
- [ ] Exact sqitch deploy-file numbers for `fnb-poll` (assign via `sqitch-expert`).
- [ ] `poll_fn.question_result` composite exact shape + how a setof-composite function inflects in
      PostGraphile 5 (confirm with `postgraphile-5-expert`) — drives `PollResults.graphql`.
- [ ] `hidden` + non-admin behavior of `get_poll_results`: return own-only vs raise (§6). Leaning
      own-only so the UI can always render the caller's submission.
- [ ] Nav icon: `i-lucide-vote` proposed — **verify it exists before use** (UC11). Fallbacks:
      `i-lucide-list-checks`, `i-lucide-square-check-big`.
- [ ] Whether to denormalize `tenant_id` onto `poll.question`/`poll.option` (recommended, uniform
      RLS) or reach it via `exists(… poll …)` (fewer columns). §5.
