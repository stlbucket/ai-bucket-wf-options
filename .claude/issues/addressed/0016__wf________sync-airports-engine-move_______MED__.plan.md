# Plan: sync-airports engine move — the datasets-UI airports sync runs on n8n

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> Spec: `.claude/specs/n8n-parallel-engine/dataset-sync.workflow.data.md` (§Engine move,
> added by this plan). **Never run any `git` command**; **never rebuild/restart the env** —
> ask the user.

**Severity: MED** · Workstream: wf · Planned: 2026-07-20 · User decision 2026-07-20: move the
`sync-airports` key to `engine: 'n8n'` (the deferred "Move to n8n" option, airports only —
`sync-breweries` stays agentic on the UI path with its twin behind wf-n8n).

## Context

The twin build (plan `0015__wf________n8n-dataset-sync-twins__________`) pre-paid the
prerequisites: `n8n_worker` grants, the built+verified workflow, the `dataset_sync_busy`
guard. The move = rekey the twin to `sync-airports` + registry flip + one SQL line. The UI
(datasets page, `useAirports`, `useTriggerWorkflow`) is untouched — the key is the abstraction.
The agentic `sync-airports` definition stays in the tree **dormant** (unreachable via the
registry; the one-line rollback).

## Changes

1. **n8n workflow rekey** (live via API, then re-export): name → `sync-airports`, webhook path
   → `sync-airports`, `begin_run('sync-airports'…)`, guard →
   `dataset_sync_busy('sync-airports', 'sync-airports')` (both engines share the key now).
   Repo: `n8n/workflows/sync-airports.json` replaces `n8n-sync-airports.json`.
2. **Registry** (`trigger-workflow.plugin.ts`): `'sync-airports': { engine: 'n8n',
   permission: null }`; remove the `'n8n-sync-airports'` twin entry.
3. **DB** (`db/fnb-airports/deploy/00000000010810_airports_fn.sql`, edit-in-place):
   `airport_sync_status` n8n OR key `'n8n-sync-airports'` → `'sync-airports'`.
4. **wf-n8n page**: `triggerableKeys` → `['n8n-exerciser', 'n8n-sync-breweries',
   'sync-airports']` (+ `wf-n8n.ui.md`).
5. **R21 propagation**: global-rules R22 inventory line (sync-airports now n8n);
   `fnb-stack-implementor` skill layout line; n8n-parallel-engine spec files (README locked
   decision + dataset-sync §Engine move + `_shared.data.md` registry snippet);
   agentic-workflow-engine dataset-sync status note (definition dormant).
6. `pnpm build` → ⏸ **USER REBUILD** (sqitch + graphql-api-app/tenant-app) → verify: webhook
   `/webhook/sync-airports` run row; user clicks the datasets **Sync airports** button →
   `n8n.workflow_run` row `success`, `in_progress` polling works.

## Accepted behavior changes
`triggerWorkflow('sync-airports')` now returns `{ accepted: true, runId: null }` always
(respond-immediately webhook — no already-running signal; the guard still prevents double
runs); DB-stage failures → terminal `error` row via error-handler; runs appear in the
**n8n Workflows** panel (historical agentic rows stay in wf-agentic).
