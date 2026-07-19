# Recurring: execute all recurring tasks (master playbook)

> **Execution Directive:** Invoke directly as:
>
> ```
> /fnb-stack-spec /fnb-stack-implementor .claude/issues/recurring/000_1__execute-all-recurring-tasks.md
> ```
>
> Running this playbook executes every numbered recurring plan in this directory, sequentially,
> in filename order — each via its own Execution Directive. This file — like every file in
> `recurring/` — never "finishes": **no file in this directory is ever moved after a run** (not
> to `addressed/`, not anywhere; the directory *is* the status). A run may spawn new numbered
> `identified/` items. Gate is `pnpm build`. Never run `git`; never rebuild Docker or redeploy
> the DB yourself — ask the user, then verify read-only.

**Category: infra · Recurring (no rank, no severity)**

## What this does

Executes the numbered recurring playbooks in ascending `####_` order, one at a time, each via its
own Execution Directive (each plan names its own skills, gates, and output rules):

1. `0010_recur__dead-code-sweep.plan.md` — remove cruft first so every later audit triages less
2. `0020_recur__dependency-audit.plan.md` — catch deps orphaned by the dead-code removal
3. `0030_recur__rls-permission-audit.plan.md` — security sweep of the cleaned DB tree
4. `0040_recur__spec-code-reconciliation.plan.md` — true up canonical specs against settled code
5. `0050_recur__skill-drift-reconciliation.plan.md` — skills last (R21 flows specs → skills)

If new numbered plans are added to this directory later, they join the sequence by filename order —
do not maintain a duplicate list anywhere else; the list above is illustrative, the directory
listing is authoritative.

## Rules for a run

- **Sequential, in filename order** — finish (and verify) one plan before starting the next; the
  ordering encodes real dependencies (dead code → deps → security → specs → skills).
- **Files never move** — after a plan executes, it stays in `recurring/` under its same name.
  Recurring playbooks are re-run on the next housekeeping pass; there is no "done".
- **Findings, not detours** — a plan run either fixes a finding inline (per that plan's own rules)
  or spawns a numbered `identified/[####]__[category]__[title-slug]__[SEV]__.plan.md` item (R23).
  Do not chase spawned items mid-run; queue them and keep the sequence moving.
- **Gate between plans** — `pnpm build` green before advancing to the next plan.
- **Execution log per plan** — at the start of a run, create
  `.claude/issues/recurring/executions/YYYY_MM_DD/` (today's date). As each plan finishes, write
  its results to a `.md` file in that directory named after the plan (e.g.
  `0010_recur__dead-code-sweep.md`) covering: what was fixed inline, what `identified/` items
  were spawned, anything skipped with the reason, and the gate result (`pnpm build` green/red).
  If the same date's directory already exists (a second run that day), append a numbered suffix
  to the filenames rather than overwriting (e.g. `0010_recur__dead-code-sweep.2.md`).
- **Report per plan** — at the end of the run, summarize per plan in the conversation the same
  content written to the execution log: what was fixed inline, what `identified/` items were
  spawned, and anything skipped with the reason.
