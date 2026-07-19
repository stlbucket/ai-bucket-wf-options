import { computed } from 'vue'
import { useN8nWorkflowRunsQuery } from '../generated/fnb-graphql-api'
import { toN8nWorkflowRun } from '../mappers/n8n-workflow-run'
import type { N8nWorkflowRun } from '@function-bucket/fnb-types'

// Site-admin n8n Workflows runs panel (n8n-parallel-engine spec, wf-n8n.data.md).
// Reads the gated n8n_api.workflow_runs fn (exposed as n8NWorkflowRunsList — smart-tag
// rename; p:app-admin-super enforced in SQL, R12); latest 50, manual refresh only.
export function useN8nWorkflowRuns() {
  const { data, fetching, error, executeQuery } = useN8nWorkflowRunsQuery({
    variables: { itemLimit: 50 },
  })

  return {
    runs: computed<N8nWorkflowRun[]>(() =>
      (data.value?.n8NWorkflowRunsList ?? [])
        .filter((r): r is NonNullable<typeof r> => r != null)
        .map(toN8nWorkflowRun),
    ),
    fetching,
    error,
    refresh: () => executeQuery({ requestPolicy: 'network-only' }),
  }
}
