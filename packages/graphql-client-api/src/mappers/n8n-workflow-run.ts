import type { N8nWorkflowRunsQuery } from '../generated/fnb-graphql-api'
import type { N8nWorkflowRun, WorkflowRunStatus } from '@function-bucket/fnb-types'

type N8nWorkflowRunRow = NonNullable<
  NonNullable<N8nWorkflowRunsQuery['n8NWorkflowRunsList']>[number]
>

export const toN8nWorkflowRun = (f: N8nWorkflowRunRow): N8nWorkflowRun => ({
  id: String(f.id),
  workflowKey: String(f.workflowKey),
  n8nExecutionId: f.n8NExecutionId ?? null,
  tenantId: f.tenantId ? String(f.tenantId) : null,
  status: f.status as unknown as WorkflowRunStatus,
  inputData: f.inputData,
  resultData: f.resultData,
  error: f.error,
  startedAt: new Date(f.startedAt),
  finishedAt: f.finishedAt ? new Date(f.finishedAt) : null,
})
