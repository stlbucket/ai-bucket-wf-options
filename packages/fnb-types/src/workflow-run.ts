// Workflow-engine run logs (n8n-parallel-engine spec). Two engines, two run logs:
// agent.workflow_run (agentic — Claude Agent SDK) and n8n.workflow_run (parallel n8n).
// Values mirror the GraphQL enums (UPPERCASE, R3).

export type WorkflowRunStatus = 'RUNNING' | 'SUCCESS' | 'ERROR'

export interface AgentWorkflowRun {
  id: string
  workflowKey: string
  agentSessionId: string | null
  model: string | null
  tenantId: string | null
  status: WorkflowRunStatus
  inputData: unknown
  resultData: unknown
  error: unknown
  usage: { total_cost_usd?: number } & Record<string, unknown>
  startedAt: Date
  finishedAt: Date | null
}

export interface N8nWorkflowRun {
  id: string
  workflowKey: string
  n8nExecutionId: string | null
  tenantId: string | null
  status: WorkflowRunStatus
  inputData: unknown
  resultData: unknown
  error: unknown
  startedAt: Date
  finishedAt: Date | null
}
