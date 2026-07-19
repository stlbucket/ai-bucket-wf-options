import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { attachSession, beginRun, completeRun, errorRun } from './agent-db'
import { appendTranscript } from './agent-transcripts'
import { requiredEnv } from './required-env'
import { toolResult, type AgentWorkflowDefinition } from './agent-workflows/types'

// The harness owns the full run lifecycle (_shared.data.md → The harness):
//   begin_run → query() over the closed toolbox → terminal accounting.
// Terminal writes are harness-owned: the injected complete_run tool only hands resultData to
// the harness — a run can never lie its way into 'success'; anything else (SDK error, wall-clock
// timeout, maxTurns exhausted, missing terminal tool) lands as agent_fn.error_run. This is the
// analog of the retired workflow handler's catch → error-uow write.

export async function startWorkflowRun<TInput>(
  def: AgentWorkflowDefinition<TInput>,
  input: TInput,
  ctx: { tenantId: string | null }
): Promise<string> {
  const model = def.model ?? requiredEnv('AGENT_MODEL_DEFAULT')
  const runId = await beginRun(def.key, input, ctx.tenantId, model)

  // 202 fire-and-forget: the trigger route returns runId here; the run continues detached.
  void executeRun(def, input, runId, model).catch((err) => {
    console.error(`[agent-harness] ${def.key} run ${runId} escaped the catch-all:`, err)
  })

  return runId
}

async function executeRun<TInput>(
  def: AgentWorkflowDefinition<TInput>,
  input: TInput,
  runId: string,
  model: string
): Promise<void> {
  // Harness-injected terminal tool — hands resultData over, never writes the DB itself.
  let terminalResultData: Record<string, unknown> | undefined
  const completeRunTool = tool(
    'complete_run',
    'Finish this workflow run. Call exactly once, at the end, with the run result. ' +
      'The harness records the result — this tool performs no other action.',
    { resultData: z.record(z.string(), z.unknown()) },
    async ({ resultData }) => {
      terminalResultData = resultData
      return toolResult({ acknowledged: true })
    }
  )

  const tools = [...def.tools, completeRunTool]
  const timeoutMinutes = parseInt(requiredEnv('AGENT_RUN_TIMEOUT_MINUTES'))
  const abortController = new AbortController()
  const wallClock = setTimeout(
    () => abortController.abort(new Error(`wall-clock timeout after ${timeoutMinutes}m`)),
    timeoutMinutes * 60_000
  )

  let usage: Record<string, unknown> = {}
  try {
    const run = query({
      prompt: def.goal(input, { runId }),
      options: {
        model,
        maxTurns: def.maxTurns,
        abortController,
        mcpServers: { fnb: createSdkMcpServer({ name: 'fnb', tools }) },
        // The model's ENTIRE capability surface: the closed toolbox, nothing else.
        // tools: [] disables every built-in tool (allowedTools alone only gates permission —
        // built-ins stay visible and the model wastes turns attempting them; observed with
        // Bash during sync-airports verification).
        tools: [],
        allowedTools: tools.map((t) => `mcp__fnb__${t.name}`),
        settingSources: [],
        permissionMode: 'bypassPermissions',
        // The CLI refuses --dangerously-skip-permissions as root unless it knows it is inside
        // a sandbox; the container runs as root and IS one (closed toolbox, no host FS).
        env: { ...process.env, IS_SANDBOX: '1' }
      }
    })

    let resultSubtype: string | undefined
    let resultErrorText: string | undefined
    for await (const message of run) {
      await appendTranscript(runId, message)
      if (message.type === 'system' && message.subtype === 'init') {
        await attachSession(runId, message.session_id)
      }
      if (message.type === 'result') {
        resultSubtype = message.subtype
        usage = {
          ...message.usage,
          numTurns: message.num_turns,
          totalCostUsd: message.total_cost_usd
        }
        if (message.subtype === 'success') {
          if (message.is_error) resultErrorText = message.result
        } else {
          resultErrorText = 'errors' in message ? JSON.stringify(message.errors) : undefined
        }
      }
    }

    if (terminalResultData !== undefined && resultSubtype === 'success' && !resultErrorText) {
      await completeRun(runId, terminalResultData, usage)
    } else {
      await errorRun(
        runId,
        {
          reason:
            resultSubtype === undefined
              ? 'no-result-message'
              : resultSubtype !== 'success' || resultErrorText
                ? (resultSubtype ?? 'error')
                : 'missing-terminal-tool',
          detail: resultErrorText ?? null
        },
        usage
      )
    }
  } catch (err) {
    const timedOut = abortController.signal.aborted
    await errorRun(
      runId,
      {
        reason: timedOut ? 'wall-clock-timeout' : 'sdk-error',
        detail: err instanceof Error ? err.message : String(err)
      },
      usage
    ).catch((dbErr) => {
      console.error(`[agent-harness] error_run write failed for ${runId}:`, dbErr)
    })
  } finally {
    clearTimeout(wallClock)
  }
}
