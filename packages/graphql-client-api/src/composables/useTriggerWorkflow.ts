import { ref } from 'vue'
import { useTriggerWorkflowMutation } from '../generated/fnb-graphql-api'

// The engine-agnostic workflow trigger (agentic-workflow-engine/_shared.data.md →
// triggerWorkflow). Replaces useQueueWorkflow: fire-and-forget — a truthy `accepted` means the
// agent run began (202); `accepted: false` means a singleton workflow was already running.
export interface TriggerWorkflowResult {
  accepted: boolean
  runId: string | null
}

export function useTriggerWorkflow() {
  const { executeMutation } = useTriggerWorkflowMutation()
  const fetching = ref(false)

  async function triggerWorkflow(
    workflowKey: string,
    inputData: Record<string, unknown> = {}
  ): Promise<TriggerWorkflowResult> {
    fetching.value = true
    try {
      const result = await executeMutation({ workflowKey, inputData })
      if (result.error) throw result.error
      const triggered = result.data?.triggerWorkflow
      if (!triggered) throw new Error('Trigger workflow returned no result')
      return { accepted: triggered.accepted, runId: triggered.runId ?? null }
    } finally {
      fetching.value = false
    }
  }

  return { triggerWorkflow, fetching }
}
