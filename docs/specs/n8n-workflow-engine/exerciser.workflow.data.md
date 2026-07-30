---
name: n8n-exerciser-workflow
description: n8n conversion of the wf-exerciser demo — exercises the webhook trigger, error paths (thrown + DB exception), the wait/resume analog of pull_trigger, and the error-handler + run-log plumbing.
metadata:
  type: reference
---

## Status
Draft. Replaces the `wf-exerciser` demo workflow. Same purpose — a reference implementation that
exercises every engine feature — with the feature set re-mapped to n8n.

---

## Feature mapping (old engine → n8n)

| wf-exerciser feature | n8n analog exercised here |
|---|---|
| `queueWorkflow` mutation + input definitions | `triggerWorkflow('exerciser', inputData)` → Webhook node; inputs validated by a Code node (n8n has no typed input definitions — the webhook body is the contract) |
| DAG of task uows | node chain |
| milestone container (`do-the-things`) | none — n8n has no container node; dropped |
| `maybe-throw-error` (unhandled JS throw) | IF `throwError` → **Stop and Error** node |
| `maybe-raise-exception` (`app_fn.raise_exception`) | IF `raiseExceptionMessage` → PG node calling `app_fn.raise_exception($msg)` — demonstrates a DB-raised error surfacing through the Postgres node into `error-handler` |
| trigger uow + `pull_trigger` mutation | **Wait node (resume on webhook)** — execution pauses until `POST $resumeWebhookUrl`; the resume URL is written into `workflow_run.result_data` by an intermediate PG node so an operator can fire it (`curl` / n8n editor). Replaces the dashboard's "Pull Trigger" button |
| `get-stock-quote` stub | Set node emitting `stockQuote: 420.69` |
| workflowData/stepData accumulation | node output passing + final `complete_run(result_data)` |
| `_workflowHandler` catch-all → `error_uow` | Error Workflow = `error-handler` → `n8n_fn.error_run_by_execution` |

## Workflow: `exerciser` (`n8n/workflows/exerciser.json`)

```
Webhook(exerciser) ─▶ begin_run(tenant from payload)
  ─▶ Validate input (Code: stockSymbol string, throwError bool, raiseExceptionMessage string?)
  ─▶ Set stockQuote=420.69
  ─▶ IF throwError ─▶ Stop and Error('COZ YOU ASKED')
  ─▶ IF raiseExceptionMessage ─▶ PG app_fn.raise_exception(msg)
  ─▶ PG: record resume URL in workflow_run.result_data ─▶ Wait (resume on webhook)
  ─▶ complete_run(result_data: { stockQuote, resumedAt })
```

Trigger gate: `triggerWorkflow` allow-map entry `'exerciser': 'p:app-admin-super'` — it is a
diagnostic tool, not a user feature (tighter than the old any-authenticated gate; deliberate).

Verification value: one run each of (a) clean path incl. wait/resume, (b) `throwError`, (c)
`raiseExceptionMessage` proves the webhook auth, PG credential/grants, error-handler, and
run-log plumbing end-to-end — the same role the seeded wf-exerciser played.
