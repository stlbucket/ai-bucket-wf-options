import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { awaitOperatorTrigger } from '../operator-trigger'
import { requiredEnv } from '../required-env'
import { toolResult } from '../agent-workflows/types'
import { agentWorkerQuery } from './pg'

// Exerciser toolbox (exerciser.workflow.data.md) — each tool exercises one engine feature.

export const getStockQuote = tool(
  'get_stock_quote',
  'Get the current stock quote for a symbol. Demo stub — returns a fixed quote.',
  { symbol: z.string() },
  async ({ symbol }) => toolResult({ symbol, stockQuote: 420.69 })
)

export const throwError = tool(
  'throw_error',
  'Deliberately throws an in-process error (engine error-path exercise). Never returns.',
  {},
  async () => {
    throw new Error('exerciser: deliberate tool error (throw_error)')
  }
)

export const raiseDbException = tool(
  'raise_db_exception',
  'Raises an exception inside the database via app_api.raise_exception (engine DB-error-path exercise). Never returns normally.',
  { message: z.string() },
  async ({ message }) => {
    await agentWorkerQuery('select app_api.raise_exception($1::citext)', [message])
    return toolResult({ raised: false }) // unreachable — the DB call always raises
  }
)

export const awaitOperatorTriggerTool = tool(
  'await_operator_trigger',
  'Block until an operator fires the resume endpoint for this run ' +
    '(POST /api/trigger/exerciser/resume/<runId> with the trigger-secret header). ' +
    'Pass the runId from your goal prompt.',
  { runId: z.string() },
  async ({ runId }) => {
    const resumeUrl = `/api/trigger/exerciser/resume/${runId}`
    // Discoverability: the operator has runId from the 202 response; the URL is also in the
    // app log + this tool result lands in the transcript.
    console.info(`[exerciser] run ${runId} waiting for operator: POST ${resumeUrl}`)
    const timeoutMs = parseInt(requiredEnv('AGENT_RUN_TIMEOUT_MINUTES')) * 60_000 - 10_000
    const resumedAt = await awaitOperatorTrigger(runId, timeoutMs)
    return toolResult({ resumedAt: resumedAt.toISOString(), resumeUrl })
  }
)
