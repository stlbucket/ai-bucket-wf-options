# site-admin/wf-n8n — n8n Workflow Runs Data

## Status
Implemented 2026-07-19 — built as specced; generated GraphQL names are the digit-aware-camelCase variants (`N8NWorkflowRun`, `n8NWorkflowRunsList` — see `_shared.data.md` Status).

Shared contracts: `_shared.data.md` (the `db/fnb-n8n` package, smart tags, fnb-types, registry).
This page depends on Phase 2 (the `n8n_api.workflow_runs` fn + PostGraphile exposure + smart
tags) having landed.

## GraphQL

| Operation | File | Generated hook |
|---|---|---|
| `N8nWorkflowRuns($pagingOptions)` | `packages/graphql-client-api/src/graphql/n8n/query/n8nWorkflowRuns.graphql` | `useN8nWorkflowRunsQuery()` |
| `TriggerWorkflow` (existing) | `src/graphql/agent/mutation/triggerWorkflow.graphql` | `useTriggerWorkflowMutation()` |

The query calls `n8n_api.workflow_runs` via its smart-tag-renamed root field (expected
`n8nWorkflowRunsList` — **verify in `src/generated/fnb-graphql-api.ts` / GraphiQL after the
Phase-2 codegen**). Variables: `pagingOptions: { itemLimit: 50 }`. Fragment selects every
`N8nWorkflowRun` field (R3): id, workflowKey, n8nExecutionId, tenantId, status, inputData,
resultData, error, startedAt, finishedAt.

## Composable

`packages/graphql-client-api/src/composables/useN8nWorkflowRuns.ts` (+ **barrel line** in
`src/index.ts`; re-export `apps/tenant-app/app/composables/useN8nWorkflowRuns.ts`). Identical
shape to `useAgentWorkflowRuns` (`wf-agentic.data.md`), mapping with `toN8nWorkflowRun`
(`src/mappers/n8n-workflow-run.ts`).

Trigger path: the **existing** `useTriggerWorkflow` composable — the engine routing happens
server-side in the plugin registry; this page passes `workflowKey: 'n8n-exerciser'` and the
result's `runId` is `null` by contract (webhook respond-immediately — `_shared.data.md`).

## Runtime config (tenant-app)

`apps/tenant-app/nuxt.config.ts`: `runtimeConfig.public.n8nEditorUrl: ''` sentinel; real value
via `NUXT_PUBLIC_N8N_EDITOR_URL` in the compose service env (`infrastructure.md`).

## Auth
Read: `n8n_api.workflow_runs` raises without `p:app-admin-super` (SQL gate, mirroring
`agent_api.workflow_runs`). Trigger: registry gates `n8n-exerciser` on `p:app-admin-super`.
