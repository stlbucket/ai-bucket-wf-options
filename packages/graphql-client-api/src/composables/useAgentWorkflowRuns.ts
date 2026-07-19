import { computed } from 'vue'
import { useAgentWorkflowRunsQuery } from '../generated/fnb-graphql-api'
import { toAgentWorkflowRun } from '../mappers/agent-workflow-run'
import type { AgentWorkflowRun } from '@function-bucket/fnb-types'

// Site-admin Agentic Workflows runs panel (n8n-parallel-engine spec, wf-agentic.data.md).
// Reads the gated agent_api.workflow_runs fn (p:app-admin-super — enforced in SQL, R12);
// latest 50, no pagination (no house convention yet), manual refresh only.
export function useAgentWorkflowRuns() {
  const { data, fetching, error, executeQuery } = useAgentWorkflowRunsQuery({
    variables: { itemLimit: 50 },
  })

  return {
    runs: computed<AgentWorkflowRun[]>(() =>
      (data.value?.workflowRunsList ?? [])
        .filter((r): r is NonNullable<typeof r> => r != null)
        .map(toAgentWorkflowRun),
    ),
    fetching,
    error,
    refresh: () => executeQuery({ requestPolicy: 'network-only' }),
  }
}
