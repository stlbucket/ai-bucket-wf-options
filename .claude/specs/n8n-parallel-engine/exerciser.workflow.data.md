---
name: n8n-exerciser-workflow
description: The n8n-exerciser demo workflow (webhook trigger, run-log plumbing, Stop-and-Error and DB-exception error paths, durable Wait/resume) and the shared error-handler workflow — the initial, demo-only n8n inventory.
metadata:
  type: reference
---

## Status
**Built + verified 2026-07-19** (Phase 3). Corrections from the build (authoritative where they
differ from the body below):

- **The error workflow must be ACTIVE in n8n 2.x** — an inactive error-handler is skipped with
  "Workflow … is not active and cannot be executed" and the run row stays `running`. Both repo
  JSONs carry `"active": true`; the boot import must preserve/restore that.
- **Wait-node resume URLs are signed**: `POST /webhook-waiting/<executionId>` alone returns
  `401 Invalid token`; the real `$execution.resumeUrl` carries a `?signature=…` and is found in
  the editor's execution view or via `n8n-cli execution get <id> --include-data`.
- Postgres nodes pass parameters as a single array expression in `options.queryReplacement`
  (comma-splitting would break on JSON payloads); the error jsonb is assembled server-side via
  `jsonb_build_object` from scalar params.

The entire initial n8n inventory: two workflows, both `n8n/workflows/*.json` (built in the
editor Phase 3, exported via `n8n-cli`, reproduced by the boot import). The agentic `exerciser`
is untouched — the two exercisers coexist under distinct keys.

---

## Workflow: `error-handler` (`n8n/workflows/error-handler.json`)

The shared n8n Error Workflow — every fnb-triggered workflow names it under workflow settings.
One place turns any n8n failure into a terminal run row (the n8n analog of the agentic harness
catch-all):

```
Error Trigger ─▶ Postgres (fnb-n8n-worker credential):
                 select n8n_fn.error_run_by_execution(
                   {{ $json.execution.id }},
                   jsonb: { message, lastNodeExecuted, executionUrl }  ← from the Error Trigger payload
                 )
```

Not webhook-triggered and has no registry entry — but it **must be active** (see Status
corrections: n8n 2.x refuses to invoke an inactive error workflow).

## Workflow: `n8n-exerciser` (`n8n/workflows/n8n-exerciser.json`)

Input contract (webhook body, from `triggerWorkflow` or curl):

```ts
{ stockSymbol: string, throwError?: boolean, raiseExceptionMessage?: string, waitForResume?: boolean,
  tenantId?: string, profileId?: string }   // tenantId/profileId injected by the plugin from claims
```

(No `burnTurns` — turn budgets are agent-specific; n8n has no analog.)

### Node graph

```
Webhook (POST, path n8n-exerciser, Header-Auth fnb-webhook-secret, respond: immediately)
  ─▶ Postgres: begin_run('n8n-exerciser', {{ $execution.id }}, body, tenantId) → runId
  ─▶ Set: stockQuote = 420.69 (stub, parity with the agentic get_stock_quote)
  ─▶ IF throwError        ──true─▶ Stop and Error ("exerciser: requested throw")   → error-handler → error_run
  ─▶ IF raiseExceptionMessage set ──true─▶ Postgres: select app_api.raise_exception(msg)  → PG error → error-handler → error_run
  ─▶ IF waitForResume     ──true─▶ Wait (resume: On webhook call)                  ← durable: survives n8n restart
  ─▶ Postgres: complete_run(runId, { stockQuote, resumed: <waitForResume> })
```

- Both Postgres credentials are the imported `fnb-n8n-worker` (role `n8n_worker` →
  `function_bucket`).
- **Error Workflow setting**: `error-handler` — this is what routes both error paths to
  `n8n_fn.error_run_by_execution` (the Stop-and-Error node and the raised PG exception both
  fail the execution).
- **Wait/resume**: the Wait node's resume URL (`$execution.resumeUrl`) is visible in the n8n
  editor's execution view; the operator resumes with a `curl -X POST <resumeUrl>`. Deliberately
  showcases the n8n strength the agentic exerciser lacks: the wait **survives a restart**
  (the agentic in-process waiter dies with the process — accepted limitation there).

### Trigger surface

- Registry entry (`_shared.data.md` → engine registry):
  `'n8n-exerciser': { engine: 'n8n', permission: 'p:app-admin-super' }` — diagnostic tool,
  super-admin only (parity with the agentic exerciser's gate).
- Manual trigger from the site-admin n8n page (`wf-n8n.data.md`) or GraphiQL
  (`triggerWorkflow(workflowKey: "n8n-exerciser", inputData: {...})`), or raw curl with the
  webhook secret.

### Feature mapping (vs the agentic exerciser — comparison record)

| Concern | agentic `exerciser` | `n8n-exerciser` |
|---|---|---|
| Input validation | zod `inputSchema` → 400 + issues | Webhook body used as-is (n8n IF nodes tolerate absent flags); no typed contract — a known n8n trade |
| Tool/step error | `throw_error` tool → harness catch-all | Stop and Error node → error-handler |
| DB exception | `raise_db_exception` → `app_api.raise_exception` | Postgres node → `app_api.raise_exception` (same fn, same grant lesson) |
| Wait/resume | in-process waiter, dies with the process | Wait node, durable across restarts |
| Budget kill-switch | `burnTurns` → maxTurns → `error_run` | n/a (workflow timeout settings exist; not exercised) |
| Run log | `agent.workflow_run` (harness-owned writes) | `n8n.workflow_run` (explicit PG nodes + error-handler) |

## Verification (Phase 3, read-only after triggering)

One run each, confirmed in `n8n.workflow_run` (via psql or, after Phase 5, the site-admin page):
1. Clean path with `waitForResume: true` → row `running` while waiting → resume curl →
   `success` with `result_data.stockQuote = 420.69, resumed: true`.
2. `throwError: true` → `error`, error jsonb carries the Stop-and-Error message via error-handler.
3. `raiseExceptionMessage: "boom"` → `error`, error jsonb carries the PG exception.
Each error row's `n8n_execution_id` correlates to a failed execution visible in the editor log.
