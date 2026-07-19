> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

# n8n Parallel Engine — n8n alongside the agentic engine + site-admin workflow tools

## Status
**Implemented 2026-07-19** (plan `0015__wf________n8n-parallel-engine_____________MED__`,
executed and verified the same day). Version pins resolved at implementation: n8n **2.30.7**
(official image, `docker.n8n.io/n8nio/n8n`). Corrections from the build are folded into each
file's Status block; the load-bearing ones:
- psql substitutes `:'var'` only on stdin/`-f`, never `-c` (db-init script).
- The n8n healthcheck must probe `127.0.0.1`, not `localhost` (alpine resolves `::1`; n8n is
  IPv4-only).
- n8n 2.x requires the **error workflow to be active**; `import:workflow` force-deactivates on
  import and `update:workflow --all` is retired — the import one-shot publishes each workflow
  by id (`publish:workflow --id`) after importing.
- Wait-node resume URLs are signed (`?signature=…`).
- PostGraphile 5's `typeCodecName` ignores `@name` tags on types (unlike tables) — the enum is
  named `n8n_workflow_run_status` in SQL; generated names came out `N8NWorkflowRun` /
  `n8NWorkflowRunsList` (digit-aware camelCase), absorbed by codegen + mappers.

## Purpose

Stand up a self-hosted **n8n** engine **in parallel with** the live agentic engine
(`apps/agent-app`, R22) — *not* a replacement. The stack gains a second workflow engine so that
future workflows can be assigned per-workflow to whichever engine fits (fixed sequential ETL →
n8n; judgment-bearing orchestration → agentic). Initial n8n inventory is **demo only**: an
`n8n-exerciser` workflow (mirroring the agentic exerciser's error/wait paths, plus n8n's durable
Wait node) and the shared `error-handler`. All four production workflows (`asset-scan` + reaper,
`sync-breweries`, `sync-airports`, `exerciser`) **stay agentic and untouched**.

Two new UI tools land under the **site-admin** menu (`p:app-admin-super`), one per engine:
**Agentic Workflows** and **n8n Workflows** — each a runs panel over that engine's run log
(`agent.workflow_run` / the new `n8n.workflow_run`) with a manual-trigger card; the n8n tool
additionally links out to the n8n editor on its own host port.

Relationship to prior specs: `.claude/specs/agentic-workflow-engine/` is the live engine and is
not modified (beyond the shared trigger plugin gaining engine routing). The superseded
`.claude/specs/n8n-workflow-engine/` (the full-replacement road-not-taken, 2026-07-17) stays a
historical record; this spec **carries over its still-sound infra decisions** (separate
`n8n_engine` database, own host port, workflow-as-code import loop, `n8n_worker` role shape) and
**drops its replacement premise** (no decommission, no sync-status rewiring, no custom image).

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Relationship of engines | **Coexistence** — agentic stays the engine for all production workflows; n8n added in parallel | User decision 2026-07-19. Use n8n for some workflows, agentic for others |
| Initial n8n inventory | **Demo only**: `n8n-exerciser` + shared `error-handler` | User decision 2026-07-19. Proves the full plumbing with zero risk to live workflows; production moves are later per-workflow registry edits |
| Trigger routing | **One `triggerWorkflow` mutation, engine registry** in the plugin (`{ key: { engine, permission } }`) | User decision 2026-07-19. Pages/composables stay engine-agnostic (R1); moving a workflow between engines is a one-line map edit |
| Site-admin UI scope | **Runs list + manual trigger** per engine; n8n tool links to the editor; no per-run detail page yet | User decision 2026-07-19. Covers observability + operator actions; detail pages deferred |
| Agentic engine blast radius | **Zero** — no changes to `apps/agent-app`, `db/fnb-agent`, or the agent trigger contract; only the graphql-api-app plugin (registry) and new client reads | Coexistence must not destabilize the live engine |
| n8n state storage | Separate **`n8n_engine` database** in the existing postgis cluster (dedicated `n8n_engine` login role) | Carried from superseded spec: no new container, isolated from sqitch + PostGraphile; named so it can't be confused with the `n8n` schema in `function_bucket` |
| Editor exposure | **Own host port** (`N8N_HOST_PORT`), no nginx route; site-admin page links out via `NUXT_PUBLIC_N8N_EDITOR_URL` | Carried: ZITADEL precedent, avoids n8n path-prefix fragility; operator tool, not app surface |
| n8n → fnb data access | Dedicated **`n8n_worker`** PG role calling `_fn`/granted functions only; demo-scope grant inventory (`n8n_fn.*` + `app_api.raise_exception`) | Carried, shrunk to demo scope. Mirrors `agent_worker`'s root-of-trust position |
| fnb → n8n trigger | HTTP webhook POST `${N8N_INTERNAL_URL}/webhook/<key>`, header `X-Fnb-Webhook-Secret`, respond-immediately (no runId in the 200) | Carried: deterministic, standard n8n pattern. `TriggerWorkflowResult.runId` is already nullable |
| App-side run state | New **`db/fnb-n8n`** package: `n8n.workflow_run` + `n8n_fn` begin/complete/error/running_count — **separate from `agent.workflow_run`** | Per-engine logs match per-engine tools; a unified table would mean reworking live fnb-agent for zero gain |
| GraphQL naming | Smart-tag renames in `postgraphile.tags.json5`: `n8n.workflow_run` → `N8nWorkflowRun` (+ root-field drop), enum + `n8n_api.workflow_runs` renamed too | `agent.workflow_run` already owns the `WorkflowRun` type name and the `workflowRuns` field pattern; unrenamed, the schemas collide |
| n8n image | **Official pinned image**, no custom Dockerfile | Demo scope has no binary steps (no ffmpeg/clamav). The superseded spec's `docker/n8n/Dockerfile` design is resurrected only if asset-scan ever moves |
| Workflow-as-code | `n8n/workflows/*.json` + `n8n/credentials/*.json.tpl`, imported by a one-shot `n8n-import` job before server start | Carried: definitions rebuild like sqitch/seed; secrets only via env |
| Error handling | Shared `error-handler` workflow → `n8n_fn.error_run_by_execution` | Carried: one place turns any n8n failure into a terminal `error` run row |
| Exerciser wait/resume | n8n **Wait node** (webhook resume) — durable across restarts | Deliberately showcases the n8n strength vs the agentic in-process waiter (which dies with the process) |
| Tenancy | n8n workflows are global singletons; tenant travels in the webhook payload, recorded on `n8n.workflow_run.tenant_id` | Carried; matches the agentic model |
| Nav | Two DB-registered tool rows (R14) in the site-admin module: `i-lucide-bot` (agentic) + `i-lucide-workflow` (n8n) | Nav lives in `app_fn.sql`; both icons verified in lucide |
| R22 rewrite | At implementation, R22 becomes "two engines, per-workflow assignment via the plugin registry"; agentic invariants unchanged, n8n invariants added | R21: architecture change propagates to global-rules + pattern files + skills in the same change |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | This index: decisions, task list, open questions |
| `_shared.data.md` | Integration architecture: `db/fnb-n8n` package, `n8n_worker` grants, webhook auth, the engine registry in `triggerWorkflow`, smart tags, fnb-types + mappers + composables, security model |
| `infrastructure.md` | Compose services (`n8n-db-init`, `n8n-import`, `n8n`), env vars, boot order, editor access, infra verification |
| `exerciser.workflow.data.md` | The `n8n-exerciser` demo workflow + the shared `error-handler` |
| `wf-agentic.ui.md` / `wf-agentic.data.md` | Site-admin **Agentic Workflows** page (runs panel + trigger over `agent_api.workflow_runs`) |
| `wf-n8n.ui.md` / `wf-n8n.data.md` | Site-admin **n8n Workflows** page (runs panel + trigger + editor link over `n8n_api.workflow_runs`) |

## Implementation Task List

- [x] **Phase 1 — Infrastructure**: `n8n-db-init` one-shot (creates `n8n_engine` DB + login
      role), `n8n` service (official pinned image, own host port, `n8n-data` volume),
      `n8n-import` one-shot, `n8n/` repo dirs + credential templates, the six `N8N_*` env vars in
      `.env`/`.env.example` (+ env-build docs), `N8N_INTERNAL_URL`/`N8N_WEBHOOK_SECRET` into the
      graphql-api-app service env, `NUXT_PUBLIC_N8N_EDITOR_URL` into tenant-app
      (`infrastructure.md`)
- [x] **Phase 2 — `db/fnb-n8n` package + nav rows**: scaffold via `new-db-package`;
      `n8n`/`n8n_fn`/`n8n_api` trio, `workflow_run`, RLS, `n8n_worker` role + grants (incl.
      `app_api.raise_exception`); `DEPLOY_PACKAGES` after `fnb-agent`; PostGraphile schemas
      `+ n8n, n8n_api` + the smart-tag block; add the two site-admin tool rows to
      `db/fnb-app/deploy/00000000010240_app_fn.sql` (R14 — links are dead until Phase 5, dev-only
      transient) (`_shared.data.md`)
- [x] ⏸ **USER REBUILD GATE** — Phases 1–2 land on one rebuild; then verify read-only per
      `infrastructure.md` §Verification (editor up, import job green, `n8n_worker` grants, wrong
      secret → 403)
- [x] **Phase 3 — Workflows**: `error-handler` + `n8n-exerciser` built in the editor / via
      `n8n-cli`, exported to `n8n/workflows/*.json`; all three trigger paths verified in
      `n8n.workflow_run` (clean+resume / Stop-and-Error / DB exception) (`exerciser.workflow.data.md`)
- [x] **Phase 4 — Trigger registry**: `ALLOW_MAP` → engine registry in
      `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts`; n8n branch POSTs the
      webhook with the secret header; `n8n-exerciser` entry gated `p:app-admin-super`; verify via
      GraphiQL (client mutation shape unchanged — no codegen needed for this phase)
- [x] **Phase 5 — Site-admin UI**: fnb-types (`AgentWorkflowRun`, `N8nWorkflowRun`), `.graphql`
      queries + codegen, mappers, `useAgentWorkflowRuns`/`useN8nWorkflowRuns` composables +
      barrel lines, tenant-app re-exports, the two pages (`wf-agentic`, `wf-n8n`); `pnpm build`
      green; end-to-end verify both panels + manual triggers (per-page `.ui.md`/`.data.md`)
- [x] **Phase 6 — R21 propagation + final verification**: global-rules R22 rewrite (dual
      engines), `monorepo-bootstrap-pattern.md` (n8n services), CLAUDE.md (db list, structure),
      skill-map (`n8n-cli` routing), memory sweep; superseded-spec cross-pointer; verification
      checklist per `infrastructure.md` + both UI pages

## Remaining Open Questions (deferred — none block implementation)

- [ ] n8n version pin — resolved procedurally: pin latest stable at Phase-1 implementation time
- [ ] Moving a production workflow to n8n (syncs would need `n8n_worker` grants on the upsert
      fns + sync-status dual-engine reads; asset-scan would resurrect the custom image) — per-
      workflow product calls, out of scope
- [ ] Per-run detail pages (`[id].vue` with input/result/error/usage JSON) — deferred with the
      runs-list decision
- [ ] Pagination beyond the latest 50 runs — no house pagination convention yet (global-rules
      Known Gaps); fixed window + refresh for now
- [ ] Editor SSO (ZITADEL) + production posture (queue mode, webhook worker split) — deferred
      until a deployed environment exists
- [ ] Scheduled workflows on n8n (Schedule Trigger) — trivially possible; product call

## Considered & rejected

| Alternative | Why rejected |
|---|---|
| Full migration to n8n (the superseded spec) | Already decided 2026-07-17 in favor of agentic; the user now wants both engines available, not another replacement |
| Unified run table shared by both engines | Requires reworking live `db/fnb-agent` + harness writes for zero user-visible gain; per-engine logs match the per-engine tools |
| One combined site-admin page with engine tabs | User asked for a tool per engine under the site-admin menu; two DB-registered tools is the house nav model (R14) |
| Separate per-engine trigger mutations | Callers must know the engine — leaks the engine choice into pages (violates R1's spirit); registry routing keeps it a server-side concern |
| Custom n8n image now (ffmpeg/clamav) | No binary steps in demo scope; dead weight to maintain. Resurrect `docker/n8n/Dockerfile` from the superseded spec when needed |
| nginx `/n8n` path prefix | Carried rejection: n8n sub-path hosting is fragile; the editor is operator surface |
| n8n tables as a schema inside `function_bucket` | Carried rejection: n8n migrations alongside sqitch + PostGraphile introspection risk; separate DB is free |
| Reusing the agentic `exerciser` key on n8n | Two engines running the same key would corrupt `running_count` semantics and registry routing; distinct `n8n-exerciser` key |
