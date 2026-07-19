import { fireOperatorTrigger } from '../../../../lib/operator-trigger'
import { requireTriggerSecret } from '../../../../utils/trigger-secret'

// The operator's "Pull Trigger" replacement (exerciser.workflow.data.md): resumes a waiting
// exerciser run. Same secret header as every trigger route. 404 when no waiter for the id
// (unknown run, already resumed, or the wait died with a restart — accepted limitation).
export default defineEventHandler(async (event) => {
  requireTriggerSecret(event)

  const runId = getRouterParam(event, 'runId')!
  if (!fireOperatorTrigger(runId)) {
    throw createError({ statusCode: 404, message: `no waiting exerciser run: ${runId}` })
  }
  return { resumed: true, runId }
})
