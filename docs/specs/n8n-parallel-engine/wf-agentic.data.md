# site-admin/wf-agentic — Agentic Workflow Runs Data

## Status
Implemented 2026-07-19 — built as specced; generated GraphQL names are the digit-aware-camelCase variants (`N8NWorkflowRun`, `n8NWorkflowRunsList` — see `_shared.data.md` Status).

Shared contracts: `_shared.data.md` (fnb-types, mappers, registry). This page is **pure client
work over the existing implemented DB surface** — `agent_api.workflow_runs` and the
`triggerWorkflow` mutation already exist; no DB or plugin changes belong to this page.

## GraphQL

| Operation | File | Generated hook |
|---|---|---|
| `AgentWorkflowRuns($pagingOptions)` | `packages/graphql-client-api/src/graphql/agent/query/agentWorkflowRuns.graphql` | `useAgentWorkflowRunsQuery()` |
| `TriggerWorkflow` (existing) | `src/graphql/agent/mutation/triggerWorkflow.graphql` | `useTriggerWorkflowMutation()` |

The query calls the implemented gated fn (`db/fnb-agent/deploy/00000000011120_agent_api.sql`;
root field per the smart-tagged schema — **verify the exact field name in
`src/generated/fnb-graphql-api.ts` / GraphiQL before writing the document**, house convention).
Variables: `pagingOptions: { itemLimit: 50 }`. Fragment selects every `AgentWorkflowRun` field
(R3): id, workflowKey, agentSessionId, model, tenantId, status, inputData, resultData, error,
usage, startedAt, finishedAt.

## Composable

`packages/graphql-client-api/src/composables/useAgentWorkflowRuns.ts` (+ **barrel line** in
`src/index.ts`; re-export `apps/tenant-app/app/composables/useAgentWorkflowRuns.ts`):

```ts
export function useAgentWorkflowRuns() {
  const { data, fetching, error, executeQuery } = useAgentWorkflowRunsQuery({
    variables: { pagingOptions: { itemLimit: 50 } },
  })
  return {
    runs: computed<AgentWorkflowRun[]>(() =>
      (data.value?.<field> ?? []).filter(Boolean).map(toAgentWorkflowRun)),
    fetching,
    error,
    refresh: () => executeQuery({ requestPolicy: 'network-only' }),
  }
}
```

Mapper `toAgentWorkflowRun` (`src/mappers/agent-workflow-run.ts`): un-Maybe, `Date` coercion on
timestamps, enum pass-through (UPPERCASE), `usage` passed as-is.

Trigger path: the **existing** `useTriggerWorkflow` composable, unchanged.

## Auth
Read: `agent_api.workflow_runs` raises without `p:app-admin-super` (SQL gate) — surface the
GraphQL error via the composable's `error`. Trigger: registry `permission` per key (exerciser
`p:app-admin-super`; syncs any authenticated user).
