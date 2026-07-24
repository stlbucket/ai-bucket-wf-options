# Execution log — 0040_recur__spec-code-reconciliation — 2026-07-23

Doc-only leg. The reconciliation surface this run: the **polls feature** (`db/fnb-poll` +
`tools/poll` specs, shipped 2026-07-23) and the **nav-collapsible-sections** work
(`.claude/specs/nav-collapsible-sections/`, implemented 2026-07-23).

## Fixed inline (canonical files)

1. **Deploy-order drift — the 12→13 package landing.** `.env` `DEPLOY_PACKAGES` carries thirteen
   packages with `fnb-poll` after `fnb-todo`. `CLAUDE.md` was already current ("thirteen", full
   list), but **`monorepo-bootstrap-pattern.md`** (§`db-migrate`) still had the 12-package list
   omitting `fnb-poll` and said "all twelve must deploy". Updated: inserted `fnb-poll`,
   "twelve → thirteen". Verified `graphile.config.ts` `pgServices.schemas` exposes
   `poll`/`poll_api` (so the "must deploy or it fails at boot" claim holds for the new package).
2. **Poll `_shared.data.md` status drift (R20).** The four page specs + README say
   `Implemented (2026-07-23)`, but `_shared.data.md` still said `Draft — fill in all [FILL IN]`,
   citing open items the README records as resolved (sqitch numbers `011100–011130`, icon
   `i-lucide-vote`). Status line trued up to Implemented, and the one remaining `[FILL IN]`
   (the `poll_fn.question_result` composite shape) resolved against the shipped DDL — the real
   shape has `vote_count` (not `count`) plus `respondent_count`, and inflects as GraphQL
   `QuestionResult` via the `getPollResultsList` field (verified in the generated codegen file).

## Checklist results

- **Pattern files vs code** — the bootstrap-pattern drift above was the only pattern-file drift.
  `graphql-api-pattern.md` untouched-and-true for the poll work: composables
  (`usePollList`/`usePollDetail`/`usePollMsg`) + mappers follow DB → PostGraphile → urql →
  composable-re-export with no inline re-description.
- **global-rules R1–R24** — no contradictions. Nav-collapsible is pure tenant-layer component +
  client state; nav data still comes from the DB registration (R14 — `app_fn.sql` +
  `res.sql` edits are registry/nav data rows). Poll follows R8 (`poll_api`→`poll_fn`), R9 (RLS
  on all five tables), R3 (poll types in `fnb-types`, codegen internal, mappers bridge).
- **Per-page specs (R18–R20)** — poll: full README + `_shared` + both page pairs ✓.
  nav-collapsible-sections: README (`Implemented`, locked decisions, no divergence note) +
  `nav.ui.md`/`nav.data.md` ✓. Gap: **`tools/todo/` has no README.md** (required index) →
  spawned 0550 (below).
- **R21 single-description invariant** — no new inline stack re-descriptions.

## Spawned identified/ items

- **`0550__specs_____todo-spec-readme-missing________LOW__`** — `tools/todo/` spec dir lacks the
  required README index (its four page specs are Implemented; sibling `tools/poll/` models the
  house shape). Mode-1 retro-README job — spawned rather than written mid-sweep.

## Gate

Doc-only edits (two spec files + one new `identified/*.md`); no code touched. `pnpm build`
unaffected — green as of the 0020 leg.
