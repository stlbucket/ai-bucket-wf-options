import { z } from 'zod'
import {
  awaitOperatorTriggerTool,
  getStockQuote,
  raiseDbException,
  throwError
} from '../agent-tools/exerciser'
import type { AgentWorkflowDefinition } from './types'

// Reference workflow (exerciser.workflow.data.md): exercises trigger auth + the zod input
// contract, both error paths (tool throw, DB exception), the maxTurns kill-switch, the
// in-process wait/resume analog, and the run-log plumbing end-to-end.

const inputSchema = z.object({
  stockSymbol: z.string(),
  throwError: z.boolean(),
  raiseExceptionMessage: z.string().optional(),
  burnTurns: z.boolean().optional()
})

type ExerciserInput = z.infer<typeof inputSchema>

export const exerciser: AgentWorkflowDefinition<ExerciserInput> = {
  key: 'exerciser',
  inputSchema,
  maxTurns: 10,
  tools: [getStockQuote, throwError, raiseDbException, awaitOperatorTriggerTool],
  goal: (input, { runId }) => `You are exercising the fnb workflow engine. This is run ${runId}.
Your input is: ${JSON.stringify(input)}

Follow these steps exactly:
1. Call get_stock_quote for the symbol "${input.stockSymbol}" and remember the quote.
2. If throwError is true, call throw_error, then STOP — call no further tools (not even
   complete_run) regardless of the outcome.
3. If raiseExceptionMessage is set, call raise_db_exception with that message, then STOP —
   call no further tools (not even complete_run) regardless of the outcome.
4. If burnTurns is true, keep calling get_stock_quote over and over and NEVER finish.
5. Otherwise (no error flags set): call await_operator_trigger with runId "${runId}", wait for
   it to return, then finish by calling complete_run with resultData { stockQuote, resumedAt }.`
}
