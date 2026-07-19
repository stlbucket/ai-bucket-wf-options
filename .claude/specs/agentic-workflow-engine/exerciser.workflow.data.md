---
name: agentic-exerciser-workflow
description: Agentic conversion of the wf-exerciser demo — exercises the trigger endpoint auth + zod input contract, tool-error and DB-exception error paths, budget kill-switches, the in-process wait/resume analog of pull_trigger, and the harness + run-log plumbing.
metadata:
  type: reference
---

## Status
**Implemented 2026-07-17** — all four paths verified live (clean+wait/resume, throwError,
raiseExceptionMessage, burnTurns→maxTurns). Corrections from the build:
- `await_operator_trigger` takes `runId` as a zod param (the goal passes it); the resume URL is
  **not** written to `result_data` mid-run (would breach harness-owned terminal writes) — the
  operator derives it from the 202's runId; it also lands in app logs + the transcript.
- Error-path goal steps must say **"then STOP — call no further tools (not even
  complete_run)"** — without it an agent continued past the DB exception into the waiter.
- `raise_db_exception` calls `app_api.raise_exception` (`app_fn.` variant doesn't exist).

---

## Feature mapping (old engine → agent harness)

| wf-exerciser feature | agentic analog exercised here |
|---|---|
| `queueWorkflow` mutation + input definitions | `triggerWorkflow('exerciser', inputData)` → trigger route; **zod `inputSchema`** validates the body (400 + issues) — typed input definitions return (the n8n conversion lost them) |
| DAG of task uows | goal prompt + tool sequence chosen by the agent |
| milestone container (`do-the-things`) | none — no container concept; dropped (same as n8n) |
| `maybe-throw-error` (unhandled JS throw) | `throwError` input → the agent is instructed to call `throw_error`, a tool whose handler throws; proves a tool exception routed per the goal prompt lands as `error_run` |
| `maybe-raise-exception` (`app_fn.raise_exception`) | `raiseExceptionMessage` input → `raise_db_exception` tool calling `app_fn.raise_exception($msg)` — a DB-raised error surfacing through a tool handler into the harness catch-all |
| trigger uow + `pull_trigger` mutation | **`await_operator_trigger` tool** — records the resume URL in `workflow_run.result_data`, then blocks on an in-process waiter (EventEmitter keyed by runId, timeout `$AGENT_RUN_TIMEOUT_MINUTES`-bounded) until `POST /api/trigger/exerciser/resume/<runId>` (same secret header) fires. Replaces the dashboard's "Pull Trigger" button with a `curl`. **Accepted limitation:** the wait does not survive an agent-app restart (the n8n Wait node did); the durable upgrade path is SDK session resume — deferred (README → Open Questions) |
| `get-stock-quote` stub | `get_stock_quote` tool returning `{ stockQuote: 420.69 }` |
| workflowData/stepData accumulation | agent-carried context → final `complete_run(resultData)` |
| `_workflowHandler` catch-all → `error_uow` | harness catch-all → `agent_fn.error_run` (`_shared.data.md` → Harness) |
| — (new) | **budget kill-switches**: input `burnTurns: true` makes the goal instruct the agent to loop `get_stock_quote` past `maxTurns` — proves the maxTurns → `error_run` path |

## Workflow: `exerciser` (`agent-workflows/exerciser.ts`)

Definition: `inputSchema`
`{ stockSymbol: string, throwError: boolean, raiseExceptionMessage?: string, burnTurns?: boolean }`;
`maxTurns: 10`; not singleton; model default.

Toolbox: `get_stock_quote`, `throw_error`, `raise_db_exception`, `await_operator_trigger`,
`complete_run` (harness-injected).

### Goal prompt sketch

> You are exercising the workflow engine with input `<input JSON>`. Call `get_stock_quote` for
> `<stockSymbol>`. If `throwError` is true, call `throw_error`. If `raiseExceptionMessage` is
> set, call `raise_db_exception` with it. If `burnTurns` is true, call `get_stock_quote`
> repeatedly and never finish. Otherwise call `await_operator_trigger` and, once it returns,
> finish with `complete_run({ stockQuote, resumedAt })`.

Trigger gate: `triggerWorkflow` allow-map entry `'exerciser': 'p:app-admin-super'` — a
diagnostic tool, not a user feature (tighter than the old any-authenticated gate; deliberate,
same as the n8n spec).

Verification value: one run each of (a) clean path incl. wait/resume, (b) `throwError`,
(c) `raiseExceptionMessage`, (d) `burnTurns` proves the trigger auth + input contract, the
`agent_worker` PG grants, the harness error catch-all, the budget caps, transcripts, and the
run-log plumbing end-to-end — the same role the seeded wf-exerciser played, plus the
agent-specific failure modes the old engine didn't have.
