import type { AgentWorkflowRunsQuery } from '../generated/fnb-graphql-api'
import type { AgentWorkflowRun, WorkflowRunStatus } from '@function-bucket/fnb-types'

type AgentWorkflowRunRow = NonNullable<
  NonNullable<AgentWorkflowRunsQuery['workflowRunsList']>[number]
>

export const toAgentWorkflowRun = (f: AgentWorkflowRunRow): AgentWorkflowRun => ({
  id: String(f.id),
  workflowKey: String(f.workflowKey),
  agentSessionId: f.agentSessionId ?? null,
  model: f.model ?? null,
  tenantId: f.tenantId ? String(f.tenantId) : null,
  status: f.status as unknown as WorkflowRunStatus,
  inputData: f.inputData,
  resultData: f.resultData,
  error: f.error,
  usage: (f.usage ?? {}) as AgentWorkflowRun['usage'],
  startedAt: new Date(f.startedAt),
  finishedAt: f.finishedAt ? new Date(f.finishedAt) : null,
})
