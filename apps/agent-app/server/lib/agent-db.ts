import { agentWorkerQuery } from './agent-tools/pg'

// Thin wrappers over the agent_fn surface (db/fnb-agent). All terminal-state writes are
// HARNESS-owned — no workflow tool ever calls these at the model's discretion
// (_shared.data.md → Harness).

export async function beginRun(
  workflowKey: string,
  inputData: unknown,
  tenantId: string | null,
  model: string
): Promise<string> {
  const res = await agentWorkerQuery<{ begin_run: string }>(
    'select agent_fn.begin_run($1::citext, $2::jsonb, $3::uuid, $4::text) as begin_run',
    [workflowKey, JSON.stringify(inputData ?? {}), tenantId, model]
  )
  return res.rows[0]!.begin_run
}

export async function attachSession(runId: string, agentSessionId: string): Promise<void> {
  await agentWorkerQuery('select agent_fn.attach_session($1::uuid, $2::text)', [
    runId,
    agentSessionId
  ])
}

export async function completeRun(
  runId: string,
  resultData: unknown,
  usage: unknown
): Promise<void> {
  await agentWorkerQuery('select agent_fn.complete_run($1::uuid, $2::jsonb, $3::jsonb)', [
    runId,
    JSON.stringify(resultData ?? {}),
    JSON.stringify(usage ?? {})
  ])
}

export async function errorRun(runId: string, error: unknown, usage: unknown): Promise<void> {
  await agentWorkerQuery('select agent_fn.error_run($1::uuid, $2::jsonb, $3::jsonb)', [
    runId,
    JSON.stringify(error ?? {}),
    JSON.stringify(usage ?? {})
  ])
}

export async function runningCount(workflowKey: string): Promise<number> {
  const res = await agentWorkerQuery<{ running_count: number }>(
    'select agent_fn.running_count($1::citext) as running_count',
    [workflowKey]
  )
  return res.rows[0]!.running_count
}
