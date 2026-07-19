---
name: claude-agent-sdk
description: >
  Expert in the Claude Agent SDK as used by the fnb agentic workflow engine (apps/agent-app —
  R22). Use this skill for any task touching the SDK: query() options, custom tool() /
  createSdkMcpServer toolboxes, toolbox closure, permission and session semantics, result/usage
  accounting, or adding/altering a workflow definition or the harness. Triggers include: "add a
  workflow", "add a tool to the toolbox", "agent-app", "agent harness", "SDK options",
  "maxTurns", "allowedTools", or any @anthropic-ai/claude-agent-sdk question. Prefer this skill
  over memory — several SDK behaviors here were learned the hard way in live runs.
---

# Claude Agent SDK (fnb agentic workflow engine)

The stack's workflow engine is `apps/agent-app` — a headless Nuxt app running the Claude Agent
SDK. **The spec is the source of truth** (`.claude/specs/agentic-workflow-engine/` — README,
`_shared.data.md`, `infrastructure.md`, per-workflow files); `global-rules.md` → R22 states the
invariants. This skill holds the SDK facts and the gotchas the spec doesn't restate.

## House layout (where things live)

| Thing | Path |
|---|---|
| Harness (run lifecycle, terminal accounting) | `apps/agent-app/server/lib/agent-harness.ts` |
| Workflow definitions (agents-as-code) | `apps/agent-app/server/lib/agent-workflows/<key>.ts` + static registry `index.ts` |
| Definition interface + `toolResult` helper | `apps/agent-app/server/lib/agent-workflows/types.ts` |
| Tools (domain-grouped; ALL side effects live here) | `apps/agent-app/server/lib/agent-tools/<domain>.ts` |
| `agent_worker` pg pool (tools/harness only) | `apps/agent-app/server/lib/agent-tools/pg.ts` |
| `agent_fn` wrappers (begin/attach/complete/error/sweep/count) | `apps/agent-app/server/lib/agent-db.ts` |
| Trigger routes + shared handler | `apps/agent-app/server/api/trigger/` + `server/lib/trigger-handler.ts` |
| Transcript JSONL writer | `apps/agent-app/server/lib/agent-transcripts.ts` |
| Croner scheduler + boot sweep + reaper | `apps/agent-app/server/plugins/agent-scheduler.ts` |
| Dev smoke test (one tiny model call) | `GET /api/dev/sdk-smoke` (dev-only, trigger-only) |

## The house `query()` recipe

```ts
query({
  prompt: def.goal(input, { runId }),
  options: {
    model,                                   // def.model ?? $AGENT_MODEL_DEFAULT
    maxTurns: def.maxTurns,
    abortController,                         // wall-clock cap ($AGENT_RUN_TIMEOUT_MINUTES)
    mcpServers: { fnb: createSdkMcpServer({ name: 'fnb', tools }) },
    tools: [],                               // ← REQUIRED for toolbox closure (see gotchas)
    allowedTools: tools.map(t => `mcp__fnb__${t.name}`),
    settingSources: [],                      // no filesystem settings
    permissionMode: 'bypassPermissions',
    env: { ...process.env, IS_SANDBOX: '1' } // ← required as root (see gotchas)
  }
})
```

## Hard-won gotchas (verified in live runs, 2026-07-17)

1. **`allowedTools` alone does NOT close the toolbox.** It only gates permission — built-in
   tools stay *visible* to the model, which will waste turns attempting them (observed: a sync
   run burned 12 turns trying `Bash` to get a timestamp). `tools: []` is the real switch — it
   removes all built-in tools from the base toolset. Always set both.
2. **`bypassPermissions` refuses to run as root** unless the spawned CLI knows it is sandboxed:
   pass `env: { ...process.env, IS_SANDBOX: '1' }`. The dev container runs as root and IS a
   sandbox (closed toolbox, no host FS). Note `options.env` REPLACES the subprocess env —
   always spread `process.env`.
3. **`maxTurns` vs `num_turns` accounting differs** — budget generously. A 59-page sequential
   sync needs ≥ pages+2 turns and errored at `maxTurns: 60` with `num_turns: 61`; the same
   workflow once succeeded reporting 74. Size budgets from tool-call counts with real headroom
   (house sync-breweries uses 90), and treat `error_max_turns` as a tuning signal.
4. **Never ask the agent for timestamps or other environment facts** — it has no clock and no
   tools to get one; it will either hallucinate or hunt for Bash. Timing lives on the run row
   (`started_at`/`finished_at`); deterministic values belong in tool results.
5. **A restart/hot-reload kills in-flight runs** (nitro dev restarts its worker on every server
   file change). Stranded `running` rows would block singleton workflows forever — the boot
   sweep (`agent_fn.sweep_orphaned_runs()` in the scheduler plugin) flips them to
   `error | orphaned-by-restart` at every boot/reload. Don't remove it.
6. **Error-path goal prompts must say STOP.** After an intentionally-failing tool call, an
   agent will otherwise continue with the remaining steps (observed: a DB-exception run wandered
   into a 15-minute waiter). Spell out "then STOP — call no further tools (not even
   complete_run)".
7. **Nitro route shadowing:** a static directory (e.g. `trigger/exerciser/resume/…`) shadows a
   param route (`trigger/[key].post.ts`) for the exact overlapping path — that key needs an
   explicit static route file delegating to the shared handler.
8. **New nitro plugin files need a dev-server restart** to register; edits to existing plugin
   files hot-reload. Prefer extending an existing plugin in dev.
9. **Result messages:** terminal accounting reads the `result` message (`subtype: 'success'` may
   still carry `is_error: true` — e.g. billing errors; check both). Usage payload =
   `{ ...message.usage, numTurns: message.num_turns, totalCostUsd: message.total_cost_usd }`.
10. **The `system`/`init` message carries `session_id`** — the harness writes it to
    `workflow_run.agent_session_id` (correlates run row ↔ transcript).
11. **MCP tool-call timeout** is `MCP_TOOL_TIMEOUT` (ms), effectively unbounded by default —
    long-blocking tools (operator waiters) are fine, but bound them yourself below the run's
    wall clock.
12. **SDK version pins:** `@anthropic-ai/claude-agent-sdk` is catalogued (pnpm default
    catalog); its zod peer is `^4`. Bump catalog entries, never per-app semver.

## Design rules (from the spec — do not re-derive)

- **Deterministic-tools principle:** invariant-bearing transitions are ONE atomic tool; the
  model routes on returned data but never adjudicates a security verdict.
- **Macro tools for bulk work:** per-page/per-file composites; rows never enter context.
- **Terminal writes are harness-owned:** `complete_run` only hands resultData over. Anything
  else (SDK error, timeout, maxTurns, missing terminal tool) → `agent_fn.error_run`.
- **Adding a workflow** = definition file + registry entry + (if app-triggered) an allow-map
  entry in graphql-api-app's `trigger-workflow.plugin.ts` + grants for any new `_fn` calls to
  `agent_worker` in the owning db package.
