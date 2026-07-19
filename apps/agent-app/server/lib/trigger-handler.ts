import { createError, readBody, setResponseStatus, type H3Event } from 'h3'
import { agentWorkflows } from './agent-workflows'
import { runningCount } from './agent-db'
import { startWorkflowRun } from './agent-harness'
import { requireTriggerSecret } from '../utils/trigger-secret'

// The fnb → agent-app trigger contract (_shared.data.md → Trigger contract):
// secret header → 401; unknown key → 404; zod inputSchema → 400 + issues;
// singleton pre-begin guard → 200 { accepted: false }; else begin_run → 202 fire-and-forget.
//
// Shared by [key].post.ts (param route) and exerciser.post.ts — the static
// server/api/trigger/exerciser/ directory (resume route) shadows the [key] param for the
// exact /api/trigger/exerciser path, so that key needs an explicit static route.
export async function handleTrigger(event: H3Event, key: string) {
  requireTriggerSecret(event)

  const def = agentWorkflows[key]
  if (!def) {
    throw createError({ statusCode: 404, message: `unknown workflow: ${key}` })
  }

  const body: unknown = (await readBody(event).catch(() => undefined)) ?? {}
  const parsed = def.inputSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'invalid workflow input',
      data: { issues: parsed.error.issues }
    })
  }

  if (def.singleton && (await runningCount(def.key)) > 0) {
    // Suppressed double-fire: visible in app logs, deliberately not in the run log.
    console.info(`[agent-trigger] ${def.key} already running — fire suppressed`)
    return { accepted: false, reason: 'already-running' }
  }

  // Tenant context travels in the payload (tenancy model: definitions are global singletons).
  const tenantId =
    typeof (body as Record<string, unknown>).tenantId === 'string'
      ? ((body as Record<string, unknown>).tenantId as string)
      : null

  const runId = await startWorkflowRun(def, parsed.data, { tenantId })
  setResponseStatus(event, 202)
  return { accepted: true, runId }
}
