# Plan: Tenant Polls — URN-entity poll module (yes/no + multiple-choice, date/time, discussion, OTP share)

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`. The
> authoritative spec is `.claude/specs/tenant-app/tools/poll/` (README + `_shared.data.md` +
> `index.{ui,data}.md` + `[id].{ui,data}.md`) — this plan sequences it and records verified code
> anchors; it does not restate the spec (R21). Full-stack: new `db/fnb-poll` sqitch package +
> cross-package in-place edits (fnb-app, fnb-res) + graphql-client-api + tenant-app pages. **Never
> run `git`.** In-place seed edits are invisible to `sqitch deploy` → **ask the user to
> `pnpm env-rebuild`** (memory `feedback_rebuild_ask_user`); verify read-only after. Phase 6 (OTP
> share) is **gated on `.claude/specs/otp-login/` shipping**.

**Severity: MED** (net-new feature module) · Workstream: `db/fnb-poll` + graphql-client-api +
tenant-app · Planned: 2026-07-23 · Spec status: Draft, all 11 design decisions locked; remaining
open items are plan/build-time internals (sqitch numbers, a setof-composite inflection, one icon
check) — **not** user decisions.

> **STATUS 2026-07-23 — Phases 1–5 DONE, `pnpm build` green (13/13).** `db/fnb-poll`
> (`00000000011100`–`011130`) deployed via the user rebuild; permissions/nav/module-permission
> live; graphql-client-api codegen + 3 composables + mappers + fnb-types built; tenant-app 2 pages
> + 10 components built. Verified by DB smoke test + GraphQL introspection + full repo build.
> **Phase 6 (OTP share) DEFERRED — gated on `.claude/specs/otp-login/` shipping.** The only
> remaining work is the `poll` `resolveUrnRoute` one-liner + the two share buttons.

## Context

Let any active member of a tenant conduct polls across all active members. A poll is a
URN-registered entity (`poll.poll`, modeled on `todo.todo`) holding an ordered list of questions
(yes/no or multiple-choice), with authored + respondent-supplied date/times, per-question
single/multi-select, an optional free-text "Other", per-poll admin toggles (lock-after-submit,
three-way results visibility), an optional discussion (todo/subject-URN pattern), and the same OTP
deep-link share as todo. Full design + rationale: the spec README's Locked Decisions (D1–D11).

This is a **thirteenth** `db/` package. It reuses three existing subsystems verbatim (no
reinvention): the URN registry (`fnb-res`), discussion-by-subject-URN (`msg.topic.subject_urn`),
and the otp-login deep-link share.

## Verified code anchors (2026-07-23)

**Pattern to clone — the todo module:**
- Schema/table/URN: `db/fnb-todo/deploy/00000000010450_todo.sql` — the generated `urn` column
  (`res_fn.build_urn(tenant_id,'todo','todo',id)` STORED + `uq_todo_urn`) + deferred
  `fk_todo_resource (id) references res.resource(id)` at `:45-49`. `poll.poll` mirrors this with
  `'poll','poll'`.
- `_fn`/`_api` two-layer: `db/fnb-todo/deploy/00000000010470_todo_fn.sql` — `create_todo` calls
  `res_fn.register_resource(_id, tenant, 'todo','todo', _resident_id)` `:132`; `delete_todo` calls
  `res_fn.archive_resource(_todo_id)` `:294`. `_api` permission gate shape (`jwt.has_permission('p:todo')`) `:21`.
- Policies: `db/fnb-todo/deploy/00000000010480_todo_policies.sql` — schema grants + the single
  `manage_all_for_tenant` tenant policy `:32-37`. Poll extends this with own-write + attributed-read
  on `response`/`answer` (spec `_shared.data.md` §5).

**URN registry (hard dependency, `fnb-res`):**
- `res_fn.build_urn` / `res.resource` / `res.module_permission` seed:
  `db/fnb-res/deploy/00000000011000_res.sql` — module seed list `:48-54` (add `,('poll','p:poll')`).
- `res_fn.uuid_generate_v7` `:8`, `register_resource` `:28`, `archive_resource` `:47` in
  `db/fnb-res/deploy/00000000011010_res_fn.sql`.

**Permissions + nav (in-place edits, `fnb-app`):**
- `db/fnb-app/deploy/00000000010240_app_fn.sql` `install_anchor_application()` — license_type_info
  rows carrying `p:todo`/`p:todo-admin` at `:229` (app-user), `:235` (app-admin), `:241` (super),
  `:247` (support): add `p:poll` / `p:poll-admin` alongside. Nav `tools` module tool array `:379-383`
  (todo tool `:382`): add a `polls` tool.

**Discussion + OTP reuse:**
- `packages/graphql-client-api/src/composables/useTodoMsg.ts` — clone → `usePollMsg` (query
  `DiscussionBySubject($subjectUrn)`, `startDiscussion` upserts `msg.topic` w/ `subjectUrn`). The
  `discussionBySubject.graphql` + `upsertTopic` docs already exist — no new `.graphql`.
- `apps/tenant-app/app/components/todo/TodoMsg.vue` — clone → `PollMsg.vue` (renders `Msg` with
  `topic.id`, the topic's own id).
- `apps/auth-app/server/utils/urn-route.ts` — `ROUTES` map `:6-9` (todo entry `:8`): add
  `poll: (id) => '/tenant/tools/poll/${id}'`.
- Member roster: `packages/graphql-client-api/src/graphql/app/query/residentsList.graphql`
  (`ActiveTenantResidents`) — reused by the "Send to residents" modal + any resident picker.

**PostGraphile exposure:** `apps/graphql-api-app/server/graphile.config.ts` `pgServices.schemas` —
add `poll, poll_api` (never `poll_fn`).

## Tasks (phased — mirrors the README task list; the spec holds the detail)

### Phase 1 — DB package `fnb-poll`  → skill `new-db-package`, then `fnb-db-designer` + `sqitch-expert`
- [ ] Scaffold `db/fnb-poll` via **`new-db-package`** (registers it in `DEPLOY_PACKAGES`,
      `.env` + `.env.example`, placed after `fnb-todo`; sqitch.plan dep on `fnb-app` +
      `fnb-res:00000000011000_res`). → skill `new-db-package`.
- [ ] `…_poll.sql`: `poll` schema; enums `poll_status`/`question_type`/`results_visibility`;
      tables `poll`/`question`/`option`/`response`/`answer` per spec §3–§4 (v7 PKs; `poll.poll`
      URN column + deferred FK; denormalize `tenant_id` onto all child tables for uniform RLS —
      spec §10 recommendation).
- [ ] `…_poll_fn_types.sql`: composites `question_input`, `option_input`, `answer_input`,
      `search_polls_options`, `question_result` (spec §6.1). → `postgraphile-5-expert` to confirm
      the `question_result` setof-composite inflection before finalizing.
- [ ] `…_poll_fn.sql`: `poll_fn`/`poll_api` (R8). create/update/set-options/set-status/delete
      poll; upsert/delete question+option (**draft-gated**); `save_response`/`submit_response`
      (open + not-locked + per-question validation); `search_polls`; `get_poll_results` (DEFINER,
      visibility-gated). `register_resource` on create, `archive_resource` on delete (spec §6.2).
- [ ] `…_poll_policies.sql`: schema grants + RLS. Tenant fence on structure; `own_response` (FOR
      ALL, own via `respondent_resident_urn = (select urn from app.resident where id =
      jwt.resident_id())`) + `read_others_response` (FOR SELECT, `attributed` OR `p:poll-admin`) on
      `response`/`answer` (spec §5).

### Phase 2 — cross-package in-place edits  ⚠ **USER REBUILD GATE**
- [ ] `fnb-app` `00000000010240_app_fn.sql`: `p:poll` → app-user; `p:poll`+`p:poll-admin` →
      app-admin/-super/-support. Add `polls` tool to the `tools` module
      (`'{"p:app-user","p:app-admin","p:poll"}'`, route `/tenant/tools/poll`, icon `i-lucide-vote`
      — **verify UC11**, fallback `i-lucide-list-checks`).
- [ ] `fnb-res` `00000000011000_res.sql`: add `,('poll','p:poll')` to the `res.module_permission` seed.
- [ ] `apps/graphql-api-app/server/graphile.config.ts`: add `poll`, `poll_api` to `pgServices.schemas`.
- [ ] **Stop — ask the user to `pnpm env-rebuild`** (in-place seed/nav edits need a full rebuild;
      do not rebuild yourself). Verify read-only: `\d poll.poll`, nav tool present, `p:poll` in claims.

### Phase 3 — graphql-client-api  (codegen against the live rebuilt schema)
- [ ] `src/graphql/poll/` fragments + queries (`searchPolls`, `pollById`, `pollResults`,
      `pollAttributedResponses`) + mutations (create/update/setOptions/setStatus/delete poll;
      upsert/delete question+option; save/submit response). Run `pnpm -F
      @function-bucket/fnb-graphql-client-api generate`.
- [ ] `packages/fnb-types/src/poll.ts` (spec §7 — UPPERCASE enums, `Date` timestamps) + barrel
      `src/index.ts`. Mappers `src/mappers/poll*.ts` if the composables map fragments.
- [ ] Composables `usePollList`, `usePollDetail`, `usePollMsg` in
      `src/composables/` (view types live here, R4) + **barrel exports** (the #1 miss). tenant-app
      re-exports `apps/tenant-app/app/composables/usePoll*.ts`.

### Phase 4 — tenant-app pages + components
- [ ] Pages `apps/tenant-app/app/pages/tenant/tools/poll/index.vue` + `[id].vue` (composables only,
      no `server/`). UC4/UC5/UC6/UC7/UC8/UC11/UC12; `UTable` v4 API (UC13).
- [ ] Components under `apps/tenant-app/app/components/poll/`: `PollList`, `PollListSmall`,
      `PollModal`, `PollDetail`, `PollDetailSmall`, `PollQuestionEditor`, `PollResponseForm`,
      `PollResults`, `PollSettingsModal`, `PollMsg` (per `index.ui.md` / `[id].ui.md`).

### Phase 5 — verify (read-only + `pnpm build` gate)
- [ ] After rebuild: create a poll (yes/no w/ `context_at` + multiple-choice w/ per-option
      `candidate_at` + Other) → open → answer as two members → cycle `results_visibility`
      hidden/aggregate/attributed and confirm each → lock-after-submit → close → discussion works.
      `POST /graphql-api/api/graphql` (not REST). `pnpm build` green.

### Phase 6 — OTP deep-link share  ⛔ **gated on `.claude/specs/otp-login/` shipping**
- [ ] Add the `poll` entry to `apps/auth-app/server/utils/urn-route.ts` (safe one-liner — may land
      independently, even before otp-login ships).
- [ ] Wire "Copy quick-login link" + "Send to residents" on `[id].vue` via `useDeepLink`
      (`shareToLink(poll.urn)` / `sendDeepLink(...)`) — reuse the todo share surface. Omit the
      buttons until otp-login is live.

## Gates & specialist routing
- **`new-db-package`** → scaffold `db/fnb-poll` + `DEPLOY_PACKAGES`. **`fnb-db-designer`** → schema
  / RLS / permission design. **`sqitch-expert`** → plan numbering, rework, deploy order.
  **`postgraphile-5-expert`** → `poll_api` exposure + the `question_result` inflection +
  `AnswerInput`/`QuestionInput`/`OptionInput` named-field input mapping.
- **USER REBUILD GATE** (Phase 2) — never rebuild the env yourself; ask, then verify read-only.
- **`pnpm build`** is the gate (repo-wide `pnpm lint` is known-broken).
- **Never run `git`** (CLAUDE.md + R23 sqitch rule).

## Docs to update when this ships (R21)
- `urn-registry/_shared.data.md` — add `poll` to the `res.module_permission` list.
- `otp-login/README.md` — move "Group polls" from deferred ideas to implemented; note the `poll`
  `resolveUrnRoute` entry.
- `.claude/skills/fnb-stack-spec/SKILL.md` "Implemented Modules" table — add `poll`.
- `CLAUDE.md` db-package list + `fnb-db-designer` package count (twelve → thirteen).

## Open items (resolved during execution, not user decisions)
- Exact sqitch file numbers (`sqitch-expert`).
- `poll_fn.question_result` shape + setof-composite inflection (`postgraphile-5-expert`).
- `get_poll_results` hidden/non-admin behavior (own-only vs raise) — implement own-only.
- Confirm `i-lucide-vote` exists (UC11) at nav-edit time; else `i-lucide-list-checks`.
