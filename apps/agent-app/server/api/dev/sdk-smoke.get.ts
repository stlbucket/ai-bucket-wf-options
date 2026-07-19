import { query } from '@anthropic-ai/claude-agent-sdk'

// Dev-only SDK smoke test (agentic-workflow-engine/infrastructure.md → Verification): proves
// ANTHROPIC_API_KEY + the pinned SDK work inside the container. Costs one tiny model call, so
// it is trigger-only (never a boot hook — nuxt dev restarts would spam it):
//   docker exec fnb_agent_app wget -qO- http://localhost:3000/api/dev/sdk-smoke
export default defineEventHandler(async () => {
  if (process.env.NODE_ENV !== 'development') {
    throw createError({ statusCode: 404 })
  }

  const run = query({
    prompt: 'Reply with exactly: hello from fnb agent-app',
    options: {
      model: process.env.AGENT_MODEL_DEFAULT,
      maxTurns: 1,
      tools: [],
      allowedTools: [],
      settingSources: [],
      permissionMode: 'bypassPermissions',
      // The CLI refuses --dangerously-skip-permissions as root unless it knows it is inside a
      // sandbox; the dev container runs as root and IS a sandbox (closed toolbox, no host FS).
      env: { ...process.env, IS_SANDBOX: '1' }
    }
  })

  for await (const message of run) {
    if (message.type === 'result') {
      return {
        ok: message.subtype === 'success',
        model: process.env.AGENT_MODEL_DEFAULT,
        result: message.subtype === 'success' ? message.result : message.subtype,
        usage: message.usage,
        costUsd: message.total_cost_usd
      }
    }
  }

  throw createError({ statusCode: 500, message: 'SDK run ended without a result message' })
})
