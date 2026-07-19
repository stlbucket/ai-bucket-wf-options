import type { SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk'
import type { ZodType } from 'zod'

// A closed-toolbox tool: SDK custom tool served in-process via createSdkMcpServer.
// Handlers own ALL side effects (agent_worker pool, S3, child processes, /tmp cleanup);
// the model can only invoke them with zod-validated params.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FnbAgentTool = SdkMcpToolDefinition<any>

// Agents-as-code: one definition per workflow in agent-workflows/<key>.ts, registered in the
// static map (agent-workflows/index.ts). No runtime workflow store — a workflow changes by
// editing code, exactly like the retired worker task handlers
// (_shared.data.md → Agents-as-code).
export interface AgentWorkflowDefinition<TInput = unknown> {
  key: string // route path + workflow_run.workflow_key + run-log key
  inputSchema: ZodType<TInput> // trigger-body contract (400 on mismatch)
  model?: string // default $AGENT_MODEL_DEFAULT
  maxTurns: number // hard SDK turn budget, sized per workflow
  singleton?: boolean // pre-begin concurrency guard via agent_fn.running_count
  tools: FnbAgentTool[] // the closed toolbox (harness injects complete_run)
  goal: (input: TInput, ctx: { runId: string }) => string // the run prompt
}

// Minimal MCP tool-result shape (structural — the SDK's CallToolResult accepts it).
export function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}
