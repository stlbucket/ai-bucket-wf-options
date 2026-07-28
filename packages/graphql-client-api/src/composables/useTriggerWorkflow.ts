import { ref } from 'vue'
import { useTriggerWorkflowMutation } from '../generated/fnb-graphql-api'

// The engine-agnostic workflow trigger (agentic-workflow-engine/_shared.data.md →
// triggerWorkflow). Replaces useQueueWorkflow: fire-and-forget — a truthy `accepted` means the
// agent run began (202); `accepted: false` means a singleton workflow was already running.
// `result` is the webhook's response body (lastNode workflows respond with their final node's
// JSON; respond-immediately workflows return n8n's "Workflow was started" blob) — null when the
// body isn't JSON. Existing callers ignore it.
export interface TriggerWorkflowResult {
  accepted: boolean
  runId: string | null
  result: unknown | null
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
      return {
        accepted: triggered.accepted,
        runId: triggered.runId ?? null,
        result: triggered.result ?? null,
      }
    } finally {
      fetching.value = false
    }
  }

  return { triggerWorkflow, fetching }
}
