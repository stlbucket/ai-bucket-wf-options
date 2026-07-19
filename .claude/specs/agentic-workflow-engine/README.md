> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

# Agentic Workflow Engine — migration from graphile-worker (Full replacement, Claude Agent SDK)

## Status
**Implemented 2026-07-17** (plan `0015__wf________agentic-workflow-engine_________MED__`,
executed and verified end-to-end the same day — all four workflows + reaper live, old engine
decommissioned, R21 propagation done). Version pins resolved at implementation:
`@anthropic-ai/claude-agent-sdk` `^0.3.212` (zod peer `^4` → `zod ^4.4.3`), `croner ^10.0.1`,
default model `claude-haiku-4-5`. Implementation corrections are folded into each file's
**Implementation notes**; the `claude-agent-sdk` skill carries the SDK gotchas.

> **Competing alternative** to `.claude/specs/n8n-workflow-engine/` — same mission, same
> workflow inventory, same retirement blast radius, different engine. **Exactly one of the two
> specs gets implemented**; choosing one supersedes the other (each spec's
> `decommission.data.md` includes marking the loser superseded).

## Purpose

Replace the entire fnb workflow system — the graphile-worker runner (`apps/worker-app`), the
`wf` module (schema, UOW DAG, templates), and the VueFlow Workflow Dashboard — with an
**agent-orchestrated engine**: a headless **`apps/agent-app`** running the **Claude Agent SDK**.
Each workflow is a **goal prompt + a closed toolbox** of deterministic, zod-validated custom
tools; the agent decides the steps at runtime instead of following a fixed DAG. All current
workflows convert: the **asset-scan** pipeline (+ its deterministic reaper cron),
**sync-breweries**, **sync-airports**, and the **exerciser** demo. Workflow definitions are
TypeScript in the repo (`apps/agent-app/server/lib/agent-workflows/`); app-side observability is
the `agent.workflow_run` run log (with per-run token/cost `usage`); step-level debugging is the
per-run transcript JSONL.

The bet this spec makes, versus n8n: keep everything in-house TypeScript (no new container
platform, no second database, no JSON-export workflow authoring loop), gain typed input
contracts and genuine runtime judgment (dependency-aware partial-failure handling, best-effort
branch decisions, result summarization) — at the price of per-run model cost (cents on haiku,
recorded per run) and a less mature step-debugging surface (transcripts vs n8n's editor).

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Scope | **Full replacement** — wf schema, UOW DAG, dashboard all retire | User decision 2026-07-17. One workflow system, not two (same as the n8n spec) |
| Orchestration model | **Agent-orchestrated**: goal + closed toolbox, agent sequences at runtime | User decision 2026-07-17. The genuinely agentic counterpart to the n8n spec's fixed DAGs |
| Runtime | **Claude Agent SDK** in headless `apps/agent-app` (worker-app's slot) | User decision 2026-07-17. In-house TypeScript, fits the monorepo; no new platform container |
| Relationship to n8n spec | **Competing alternative** — implement exactly one | User decision 2026-07-17. Shared contracts stated identically so comparison is direct |
| Workflow inventory | Same four + reaper (parity) | User decision 2026-07-17. Comparability over showcase features |
| Deterministic-tools principle | Invariant-bearing transitions are single atomic tools; agents orchestrate, **never adjudicate security verdicts** | The scan verdict + promote/purge is one tool; a model cannot be the source of a security decision |
| Toolbox closure | Custom SDK MCP tools only — no built-in Bash/FS/Web tools, `settingSources: []`, `allowedTools` whitelist | The model's entire capability surface is the closed, zod-validated toolbox |
| Macro tools for bulk work | Per-page / per-file composite tools; rows never enter context | Keeps sync runs at ~cents and prompts clean; agent spends turns on judgment, not iteration mechanics |
| fnb → agent trigger | HTTP POST `/api/trigger/<key>` with shared-secret header, `202` fire-and-forget | Same contract shape as the n8n webhooks — callers identical; deterministic, testable |
| App-side run state | New `db/fnb-agent` package: `agent.workflow_run` + `agent_fn` begin/attach/complete/error/count | Same minimum as the n8n spec, plus `model` + `usage` (cost attribution) columns |
| Terminal writes | **Harness-owned** — `complete_run` is a tool that hands result_data to the harness; begin/error/complete DB writes happen in harness code | A run can never lie its way into `success`; missing terminal tool ⇒ `error` |
| Trigger surface for pages | `triggerWorkflow` extendSchema mutation in graphql-api-app | Identical to the n8n spec (R1: pages/composables engine-agnostic) |
| Tenancy | Definitions are global singletons in code; tenant travels in the payload, recorded on `workflow_run.tenant_id` | Full-replacement consequence, same as n8n spec |
| Error handling | Harness catch-all (SDK error / timeout / maxTurns / missing terminal) → `agent_fn.error_run` | Code, not a workflow — replaces `_workflowHandler`'s catch → `error_uow` |
| Scheduling / reaper | In-process **croner** in agent-app; reaper is **deterministic code, not an agent** | No graphile-worker anywhere; no judgment in "re-fire stuck assets", so no model spend |
| Binary steps (clamd, ffmpeg) | agent-app image adds ffmpeg + clamav-clients; child processes **inside tool handlers only** | Worker-app's Dockerfile precedent; model never gets an execute tool |
| Model | Default `claude-haiku-4-5` (`AGENT_MODEL_DEFAULT`), per-definition override | Orchestration is cheap; `usage` recorded per run keeps cost honest |
| Upload → scan atomicity | Post-commit trigger POST, failures swallowed; reaper owns stranded-`pending` assets | Same trade as the n8n spec (reaper contract already existed) |
| Dashboard nav | `tenant-site-admin-wf` tool row removed; no in-app replacement in scope | Transcripts + `agent_api.workflow_runs` cover it; runs panel possible later |
| Sync concurrency | `singleton: true` definitions; trigger route pre-begin guard via `agent_fn.running_count` | Cheaper than the n8n in-graph guard; suppressed fires visible in app logs |
| Exerciser wait/resume | In-process waiter tool + resume endpoint; **does not survive restart** (accepted) | SDK session-resume durability deferred (Open Questions); demo parity is enough |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | This index: decisions, task list, open questions |
| `_shared.data.md` | Integration architecture: `db/fnb-agent` package, `agent_worker` grants, trigger contract, agents-as-code + harness conventions, `triggerWorkflow` mutation, tenancy, security model, observability |
| `infrastructure.md` | The `agent-app` compose service, custom Dockerfile, env vars, boot order, operator surface, infra verification |
| `asset-scan.workflow.data.md` | asset-scan agentic conversion (atomic `scan_and_resolve` tool + agent-owned branches); deterministic reaper; upload-endpoint trigger change |
| `dataset-sync.workflow.data.md` | sync-breweries + sync-airports conversion (macro tools, agent-owned sequencing + partial-failure policy); sync-status rewiring |
| `exerciser.workflow.data.md` | exerciser conversion (error paths, budget kill-switches, wait/resume analog) |
| `decommission.data.md` | Full retirement inventory + R21 propagation + final verification checklist |

## Implementation Task List

- [ ] **Phase 1 — Infrastructure**: `apps/agent-app` skeleton (headless Nuxt via `fnb-create-app`
      adapted — no nginx location, no base URL), Dockerfile (+ `clamd-remote.conf`), compose
      service + `agent-transcripts` volume, env vars in `.env`/env-build; SDK smoke test — a
      trivial hello-world run against `ANTHROPIC_API_KEY` (`infrastructure.md`; user runs the
      rebuild)
- [ ] **Phase 2 — `db/fnb-agent` package**: scaffold via `new-db-package`; `agent`/`agent_fn`/
      `agent_api` trio, `workflow_run`, RLS, `agent_worker` role; grants changes in `fnb-storage`
      (+ `asset_for_scan`, `stuck_pending_assets`), `fnb-location-datasets`, `fnb-airports`,
      `fnb-app`; sync-status fn reworks; `DEPLOY_PACKAGES` update; PostGraphile schemas
      `+ agent, agent_api` (`_shared.data.md`)
- [ ] **Phase 3 — Harness + toolbox plumbing**: workflow-definition types + registry, trigger
      route (secret + zod + singleton guard), `runWorkflow` harness (begin/attach/terminal
      enforcement, transcript writer, usage capture, wall-clock cap), pg-pool tool utilities,
      croner scheduler plugin; then the **exerciser** workflow — proves trigger auth, grants,
      error paths, budgets, wait/resume, run log end-to-end (`exerciser.workflow.data.md`)
- [ ] **Phase 4 — Convert workflows**: `sync-breweries`, then `sync-airports`, then `asset-scan`
      + the deterministic reaper cron (per-workflow files)
- [ ] **Phase 5 — App integration**: `triggerWorkflow` extendSchema plugin; `.graphql` doc +
      codegen + `useTriggerWorkflow`; rewire `useBreweries`/`useAirports`; upload endpoint
      post-commit trigger POST; end-to-end verify uploads + syncs on the new engine while the old
      engine still exists (parallel-run window)
- [ ] **Phase 6 — Decommission**: everything in `decommission.data.md` (worker-app, `db/fnb-wf`,
      wf client/UI code, mutation-hooks, seeds, nav row, deps); codegen re-run; `pnpm build` +
      `pnpm dep-audit` green
- [ ] **Phase 7 — R21 propagation + final verification**: global-rules (R22 rewrite), pattern
      files, tombstones, skills/skill-map (incl. new `claude-agent-sdk` specialist skill),
      CLAUDE.md, memory sweep, supersede marker on the n8n spec; run the full verification
      checklist in `decommission.data.md`

## Remaining Open Questions (deferred — none block implementation)

- [ ] SDK + model version pins — resolved procedurally: pin `@anthropic-ai/claude-agent-sdk`
      latest stable + `claude-haiku-4-5` at Phase-1 implementation time
- [ ] Durable wait/resume via SDK session resume (exerciser's in-process waiter dies with the
      process) — accepted limitation for the demo; revisit if a real human-in-the-loop workflow
      arrives
- [ ] Real AI tagging (`add_asset_tags` stays the `ai-tags-coming-soon` stub for parity) — the
      obvious agentic showcase (vision model on the scanned asset); product call, out of scope
- [ ] Cost guardrails beyond per-run budgets (daily spend cap / alerting over
      `workflow_run.usage`) — revisit once real usage data exists
- [ ] Admin "runs panel" UI over `agent_api.workflow_runs` — out of scope; revisit after migration
- [ ] Scheduled (nightly) dataset syncs — one croner line post-migration; product call, out of scope
- [ ] Production posture (horizontal scale of agent-app, queueing/backpressure on triggers,
      prompt-injection hardening review) — deferred until a deployed environment exists (matches
      the house's dev-first stance)

## Considered & rejected

| Alternative | Why rejected |
|---|---|
| **n8n engine** (the sibling spec) | Not rejected — the competing alternative; decided by comparing the two READMEs, not inside either spec |
| n8n AI Agent / LangChain nodes | Agent logic would live in n8n JSON with n8n's LLM abstractions; loses typed TS tools, code review, and the SDK's harness control — worst of both worlds |
| Raw Messages API tool loop (hand-rolled) | The Agent SDK *is* the productized version of that loop (sessions, budgets, MCP tool plumbing, transcripts); rebuilding it is undifferentiated harness code |
| Other agent frameworks (LangGraph etc.) | Non-Anthropic abstraction layer over the same API; the SDK is first-party, TypeScript-native, already aligned with house tooling |
| Agent adjudicates the scan verdict (separate `clamdscan` + `s3_copy`/`s3_delete` tools) | A model must never be the source of a security decision or able to mis-sequence promote-before-scan; the atomic `scan_and_resolve` tool forecloses it structurally |
| Giving the agent a Bash/Execute tool for clamdscan/ffmpeg | Opens the whole container to the model for two fixed command lines; dedicated tools cost nothing and keep the toolbox closed |
| Per-row/per-request agent turns for dataset syncs | Thousands of turns of pure mechanics; macro tools keep bulk work deterministic and runs at ~cents |
| Agentic reaper | "Re-fire stuck pending assets" has zero judgment; a cron + SQL fn does it for free |
| Keeping graphile-worker as the job substrate under the SDK | Defeats the full-replacement point; a trigger route + croner covers both entry paths |
| Transcripts in `agent.workflow_run` (jsonb column) | Unbounded row growth in the app DB; a volume of JSONL files is the right dev-posture ceiling, run row stays lean |
| Per-tenant agent definitions | Same reasoning as the n8n spec: no real customization use; tenant is payload + run-row context |
