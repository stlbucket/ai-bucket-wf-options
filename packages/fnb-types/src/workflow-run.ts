// Workflow-engine run log (n8n is the sole engine — agentic-decommission spec).
// Values mirror the GraphQL enum (UPPERCASE, R3).

export type WorkflowRunStatus = 'RUNNING' | 'SUCCESS' | 'ERROR'

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
