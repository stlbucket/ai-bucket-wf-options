# Plan: n8n parallel engine — n8n alongside the agentic engine + site-admin workflow tools

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/n8n-parallel-engine/` (README + `_shared.data.md` +
> `infrastructure.md` + `exerciser.workflow.data.md` + the four `wf-agentic`/`wf-n8n` page
> files) — this plan sequences it; it does not restate the spec (R21). Specialist skills:
> `new-db-package` (Phase 2), `sqitch-expert` (DB phases), `fnb-db-designer` (RLS/grants),
> `postgraphile-5-expert` (Phase 2 smart tags + Phase 4 plugin), `n8n-cli` (Phase 3 operator
> loop), `claude-agent-sdk` (read-only — the agentic side is not modified). **Never run any
> `git` command** (user global rule). **Never rebuild/restart the env yourself** — ask the
> user, then verify read-only.

**Severity: MED** (additive feature work) · Workstream: wf · Planned: 2026-07-19
· Spec status: Draft, decisions locked 2026-07-19 (user choices: coexistence, demo-only n8n
inventory, runs-list+trigger UI, single-mutation engine registry), no `[FILL IN]`s, open
questions all deferred non-blocking.

## Context

**Coexistence, not replacement.** The agentic engine (`apps/agent-app`, R22) stays the engine
for all four production workflows and is untouched except for one file (the trigger plugin's
allow-map → engine registry). n8n comes up in parallel (official pinned image, own host port,
state in a new `n8n_engine` DB in the existing cluster) carrying only `n8n-exerciser` +
`error-handler`. New `db/fnb-n8n` package supplies the `n8n.workflow_run` run log + `n8n_worker`
role. Two new site-admin tools (`p:app-admin-super`): **Agentic Workflows** (`i-lucide-bot`,
`/tenant/site-admin/wf-agentic`) and **n8n Workflows** (`i-lucide-workflow`,
`/tenant/site-admin/wf-n8n`) — runs panel + manual trigger each; n8n page links out to the
editor. The superseded `.claude/specs/n8n-workflow-engine/` (plan `0010__wf________…`, still
do-not-execute) is provenance for the carried infra design.

## Verified code anchors (2026-07-19)

1. **Trigger plugin**: `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts` —
   `ALLOW_MAP` at `:13–17`; agent POST at `:60` (`AGENT_INTERNAL_URL` + `x-fnb-trigger-secret`).
   `TriggerWorkflowResult.runId` already nullable; client composable
   `packages/graphql-client-api/src/composables/useTriggerWorkflow.ts` returns
   `{ triggerWorkflow, fetching }` (barrel `src/index.ts:28`) — **unchanged by this plan**.
2. **Read-fn template**: `db/fnb-agent/deploy/00000000011120_agent_api.sql` —
   `agent_api.workflow_runs(_workflow_key citext default null, _paging_options
   app_fn.paging_options default null)`, `jwt.enforce_permission('p:app-admin-super')`, limit 25
   default. `n8n_api.workflow_runs` mirrors it exactly. Policies/role precedent:
   `00000000011130_agent_policies.sql`.
3. **Smart-tag precedent**: `apps/graphql-api-app/postgraphile.tags.json5:42–48` —
   `agent.workflow_run` root-field drop. The new `n8n.workflow_run` needs that **plus `name`
   renames** (`n8n_workflow_run`, enum, `n8n_api.workflow_runs → n8n_workflow_runs`) because
   `agent.workflow_run` already owns the `WorkflowRun`/`WorkflowRunStatus` GraphQL names.
4. **Nav rows**: `db/fnb-app/deploy/00000000010240_app_fn.sql:353–357` — the site-admin
   `tool_info` array; append the two rows verbatim from `_shared.data.md` → Navigation.
5. **Password threading**: `scripts/db-deploy.ts:10–25` + `docker/migrate-entrypoint.sh:9–41`
   pass `--set agent_worker_password` to **every** package deploy (unused vars harmless) — add
   `--set n8n_worker_password="$N8N_WORKER_PG_PASSWORD"` alongside in both files.
6. **DEPLOY_PACKAGES**: `.env:17` + `.env.example:43` — insert `fnb-n8n` after `fnb-agent`.
7. **PostGraphile schemas**: `apps/graphql-api-app/server/graphile.config.ts:29` — add
   `n8n, n8n_api`.
8. **Compose anchors**: one-shot precedents `minio-init` (`docker-compose.yml:136`),
   `zitadel-init` (`:179`); `AGENT_INTERNAL_URL` env precedent at `:475` (graphql-api-app) —
   add `N8N_INTERNAL_URL` + `N8N_WEBHOOK_SECRET` there; `NUXT_PUBLIC_N8N_EDITOR_URL` to the
   tenant-app service.
9. **Grant lessons (from the agentic build, already folded into the spec)**: exerciser DB-error
   grant targets `app_api.raise_exception` (no `app_fn` variant), and it lives in **fnb-n8n's
   policies change** (fnb-app deploys before the role exists).

## Implementation phases

Follows the spec README task list. **`pnpm build` is the gate** (repo lint broken). No new npm
dependencies (n8n is Docker-side; UI uses existing packages) — no R24 catalog work expected.

### Phase 1 — Infrastructure (`infrastructure.md`)
- compose: `n8n-db-init` one-shot (postgis image, creates `n8n_engine` DB + login role,
  idempotent), `n8n-import` one-shot (official n8n image; node-based
  `n8n/scripts/render-credentials.mjs` — no gettext in the stock image; then
  `import:credentials` + `import:workflow --separate`), `n8n` service (**pin latest stable tag
  at implementation time**, own host port, `n8n-data` volume, spec's env block), volume.
- Repo `n8n/` dir: `workflows/` (empty until Phase 3 exports), `credentials/*.json.tpl`
  (`fnb-n8n-worker` PG, `fnb-webhook-secret` header auth), `scripts/render-credentials.mjs`.
- Env: the seven vars (`N8N_HOST_PORT`, `N8N_ENGINE_DB_PASSWORD`, `N8N_ENCRYPTION_KEY`,
  `N8N_WORKER_PG_PASSWORD`, `N8N_WEBHOOK_SECRET`, `N8N_INTERNAL_URL`,
  `NUXT_PUBLIC_N8N_EDITOR_URL`) in `.env` + `.env.example` (+ env-build docs if it enumerates);
  graphql-api-app + tenant-app service env additions (anchor 8).
- No nginx change; no custom Dockerfile (locked).

### Phase 2 — `db/fnb-n8n` package + nav rows (`_shared.data.md`)
- Scaffold via `/new-db-package`; `DEPLOY_PACKAGES` insert after `fnb-agent` (anchor 6).
- Changes: `n8n` schema + enum + `workflow_run` + indexes; `n8n_fn`
  (`begin_run(key, execution_id, input, tenant)`, `complete_run`, `error_run`,
  `error_run_by_execution`, `running_count` — SECURITY DEFINER); `n8n_api.workflow_runs`
  (mirror anchor 2); policies change: RLS (super-admin SELECT incl. `tenant_id IS NULL`),
  `n8n_worker` role (DO-guard + separate `ALTER ROLE … PASSWORD :'n8n_worker_password'`),
  grants (`n8n_fn.*` + `USAGE app_api` + `EXECUTE app_api.raise_exception` — anchor 9).
  First-change dep `fnb-app:00000000010250_app_policies`; `n8n_api` also needs
  `fnb-app:00000000010240_app_fn` (`paging_options`).
- Password threading in both deploy scripts (anchor 5).
- PostGraphile: schemas (anchor 7) + the three smart-tag entries (anchor 3).
- Nav: append the two tool rows at anchor 4 (links dead until Phase 5 — dev-only transient).

### ⏸ USER REBUILD GATE
Phases 1–2 land on one rebuild. **Ask the user to run it**, then verify read-only per
`infrastructure.md` §Verification: `docker compose ps` (n8n up, one-shots exited 0; only three
new services in the diff — agentic untouched); editor reachable (owner-account setup is the
user's); `psql` as `n8n_worker` can execute granted fns, cannot `select from app.profile`; nav
shows the two new tools for a super admin. Set up the `n8n-cli` API key with the user for
Phase 3.

### Phase 3 — Workflows (`exerciser.workflow.data.md`)
Build in the editor / via `n8n-cli`, export to `n8n/workflows/{error-handler,n8n-exerciser}.json`
(the export-to-repo loop proves boot import reproduces them):
1. `error-handler`: Error Trigger → PG `n8n_fn.error_run_by_execution`.
2. `n8n-exerciser`: webhook (header auth, respond immediately) → `begin_run` → Set stockQuote →
   IF throwError → Stop and Error; IF raiseExceptionMessage → PG `app_api.raise_exception`;
   IF waitForResume → Wait (webhook resume, durable) → `complete_run`. Error Workflow setting →
   `error-handler`.
Verify all three paths land in `n8n.workflow_run` (curl with the secret): clean+resume /
Stop-and-Error / DB exception; wrong secret → 403.

### Phase 4 — Trigger registry (anchor 1)
- `ALLOW_MAP` → `WORKFLOW_REGISTRY` (`{ engine: 'agent'|'n8n', permission }` — spec
  `_shared.data.md` → engine registry); existing three entries keep `engine: 'agent'` byte-for-
  byte behavior; add `'n8n-exerciser': { engine: 'n8n', permission: 'p:app-admin-super' }`;
  n8n branch POSTs `${N8N_INTERNAL_URL}/webhook/<key>` with `x-fnb-webhook-secret`, returns
  `{ accepted: response.ok, runId: null }`.
- graphql-api-app restart needed — **ask the user**. Verify via GraphiQL as super admin:
  `triggerWorkflow(workflowKey: "n8n-exerciser")` → accepted, run row appears; `exerciser`
  (agentic) still round-trips. No codegen (GraphQL shape unchanged).

### Phase 5 — Site-admin UI (page files)
- `packages/fnb-types/src/workflow-run.ts` (`WorkflowRunStatus`, `AgentWorkflowRun`,
  `N8nWorkflowRun`) + barrel line.
- `.graphql` queries (`agent/query/agentWorkflowRuns.graphql`, `n8n/query/n8nWorkflowRuns.graphql`
  — **verify generated root-field names first**, anchor 3 renames) → codegen
  (`pnpm -F @function-bucket/fnb-graphql-client-api generate`) → mappers
  (`toAgentWorkflowRun`, `toN8nWorkflowRun`) → composables `useAgentWorkflowRuns` /
  `useN8nWorkflowRuns` → **two barrel lines** (`src/index.ts` — the #1 miss) → package build.
- tenant-app: two re-exports; `runtimeConfig.public.n8nEditorUrl: ''` sentinel in
  `nuxt.config.ts`; pages `site-admin/wf-agentic/index.vue` + `site-admin/wf-n8n/index.vue`
  per the `.ui.md` files (Nuxt UI **v4** UTable columns, UEmpty, useToast; existing
  `useTriggerWorkflow` for the trigger cards).
- `pnpm build` green. Docker packages-watch rebuild considerations → ask the user for the
  restart, then verify read-only: both panels render runs, manual triggers round-trip,
  editor link opens, non-super-admin gets the SQL gate error surfaced.

### Phase 6 — R21 propagation + wrap-up
- `global-rules.md`: rewrite R22 — two engines (agent-app + n8n), per-workflow assignment via
  the plugin registry; agentic invariants unchanged; add the n8n invariants (webhook-only in,
  `n8n_worker`-via-granted-fns out, separate `n8n_engine` state).
- Pattern files: `monorepo-bootstrap-pattern.md` (n8n services/topology). CLAUDE.md: db package
  list + deploy order (+ `fnb-n8n`), structure notes.
- Skills via `.claude/skills/skill-map.md`: route `n8n-cli` as the n8n operator skill; touch
  `fnb-stack-implementor`/`fnb-stack-spec` engine references (they currently say "the stack's
  ONLY workflow engine").
- `.claude/memory/` sweep for single-engine assertions. Spec Status lines → Implemented.
- Final verification checklist (`infrastructure.md` §Verification + both `.ui.md` interaction
  tables). Ask the user before moving this plan to `addressed/` (completion hand-off).

## Sequencing summary

1. Phases 1–2 (compose/env + sqitch — **no git ever**) → **user rebuild** → infra verification +
   `n8n-cli` setup.
2. Phase 3 workflows on the live editor, exported to the repo as each verifies.
3. Phase 4 plugin registry → user restarts graphql-api-app → GraphiQL verify.
4. Phase 5 codegen + UI → user restart → panel verify.
5. Phase 6 propagation → sign-off.
User touchpoints: one rebuild, editor owner-account + n8n-cli API key, two service restarts,
final sign-off.

## Out of scope / linked (spec README deferrals)

- Moving any production workflow to n8n (per-workflow product calls; asset-scan would resurrect
  the superseded spec's custom image).
- Per-run detail pages; pagination beyond latest-50; polling.
- Editor SSO / production posture; scheduled n8n workflows.
- `0010__wf________n8n-workflow-engine_____________MED__` stays superseded/do-not-execute
  (cross-pointer added 2026-07-19); `0030__wf________wf-rls-missing__________________CRT__`
  unaffected (wf module already retired).
