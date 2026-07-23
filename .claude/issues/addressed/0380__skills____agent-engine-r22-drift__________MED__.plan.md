# Plan: Purge retired agent-engine (apps/agent-app) references from the skills — R22 propagation

> **Execution Directive:** Implement via the `fnb-stack-spec` skill (skill governance). R21: the
> architecture change (agentic-decommission → n8n is the sole engine, R22) must be propagated to the
> specs + both stack skills; this item completes the *skill* half. Invoke:
> `/fnb-stack-spec .claude/issues/identified/0380__skills____agent-engine-r22-drift__________MED__.plan.md`
> Doc-only — `.claude/skills/*/SKILL.md` only. Never run `git`.

**Severity: MEDIUM** (doc-only, but actively misleads implementors about the core workflow-engine
architecture — points at a nonexistent app/package/role) · Category: skills · Identified: 2026-07-22
(spawned by the 0050_recur skill-drift leg of the 2026-07-22 housekeeping run)

## Details

`apps/agent-app`, `db/fnb-agent`, the `agent_worker`/`agent_fn` roles/schemas, and the
`claude-agent-sdk` skill were **decommissioned** (addressed/`0017__wf__agentic-decommission`).
global-rules **R22 now reads "n8n is the sole workflow engine"** and `apps/agent-app` /
`db/fnb-agent` no longer exist (commit `a13d3cc "no fnb-agent"`). But ~6 skills still describe the
agent engine as live — an R21 propagation gap left in the skills after the specs/global-rules were
updated. The db-list count fixes (phantom `fnb-agent`, missing `fnb-game`/`fnb-notify`) and the
"seven→ten packages" wording were already corrected inline in the 2026-07-22 run; this item is the
remaining **narrative** drift.

Concrete locations (verify + rewrite each to the n8n reality — the engine is the n8n compose
service trio, specs `.claude/specs/n8n-parallel-engine/` + `.claude/specs/agentic-decommission/`,
skill `n8n-cli`):

- **`fnb-stack-implementor/SKILL.md`** (the worst offender):
  - L102 — "apps/agent-app → primary workflow engine — Claude Agent SDK harness … PARALLEL n8n
    engine (R22 dual engines)". R22 is now *sole* n8n, not dual. Remove the agent-app row; keep n8n.
  - L113 — the ASCII db-package list still has `fnb-agent` and omits `fnb-notify`
    (has `fnb-game`). Fix to the 12-package `.env` order.
  - L114 — "(agent-app not routed)" Caddy aside — drop.
  - L125, L127 — "`agent-app` is the headless exception … agent→fnb is `agent_worker`-via-`_fn`".
    Replace with the n8n worker model (`n8n_worker` over the compose trio).
  - L598 — the file-map row `apps/agent-app/server/lib/{agent-harness.ts,agent-workflows/,agent-tools/}`
    (skill `claude-agent-sdk`) — points at deleted paths. Replace with `n8n/workflows/*.json` +
    the `triggerWorkflow` registry, skill `n8n-cli`.
- **`fnb-stack-spec/SKILL.md`** L46, L205 — "workflows now run in `apps/agent-app`; spec
  `agentic-workflow-engine/`, R22" / "`agentic-workflow-engine/` (the workflow engine — `apps/agent-app`,
  R22)". Retarget to the n8n engine + its live specs.
- **`fnb/SKILL.md`** L47 — the skills menu lists row 11 `claude-agent-sdk` as "The agent-app
  workflow engine (R22)". That skill is retired; the current workflow skill is `n8n-cli`. Replace
  or remove the row.
- **`new-db-package/SKILL.md`** L89 — "`fnb-agent` must precede `fnb-storage`/…". Change to `fnb-n8n`.
- **`sqitch-expert/SKILL.md`** L28–29 — the db/ tree still has `fnb-agent/ ← agent run log +
  agent_worker role …`. Replace with `fnb-n8n/` (already the run log) and add `fnb-notify/`;
  drop the `agent_fn`/`agent_worker` mentions.
- **`fnb-acquire-dataset/SKILL.md`** — 2 agent-engine references (grep `agent`): reconcile to n8n
  (the sync-<name> workflows run on n8n — see `sync-airports`/`sync-breweries`).

Leave **`graphile-worker-expert/SKILL.md`** as-is — it is explicitly self-labeled LEGACY/retired and
its agent references are intentional historical context (though its own "engine is now agent-app"
description line is itself stale, it is a retired reference skill; optional to touch).

## Why MED not LOW

Unlike a stale package count, these lines tell an implementor to build workflow/DB code against an
`apps/agent-app` + `agent_worker` that no longer exist. A stack-implementor run that trusts them
would produce non-deploying work. Doc-only, but high-confusion.

## Verification

- `grep -rn "agent-app\|fnb-agent\|agent_worker\|agent_fn\|agentic-workflow-engine\|claude-agent-sdk"
  .claude/skills/*/SKILL.md` returns only `graphile-worker-expert/SKILL.md` (intentional legacy).
- Every workflow-engine reference in the stack skills names n8n (the compose trio + `triggerWorkflow`
  registry + `n8n/workflows/`), consistent with global-rules R22 and CLAUDE.md.

---

## OUTCOME — done 2026-07-22 (same-day, via `fnb-stack-spec` skill governance)

Fixed inline across **8 skills** (more locations than the initial enumeration — the plan was built
from a filename `-l` count; a full-body grep during execution surfaced the rest):

- **`fnb-stack-implementor/SKILL.md`** — app-inventory row (agent-app → "n8n compose trio, not an
  app"), the ASCII db-list (dropped `fnb-agent`, added `fnb-notify`), the Caddyfile aside
  ("n8n on its own host port"), the whole "headless exception / dual engines" narrative block
  (rewritten to "n8n is the sole engine" with the `WORKFLOW_REGISTRY` / `trigger-workflow.plugin.ts`
  / `n8n_worker`-via-`_fn` facts), the file-map row (`apps/agent-app/server/lib/*` → `n8n/workflows/*.json`
  + the trigger plugin), and the skill-map pointer ("agent workflows (`claude-agent-sdk`)" →
  "n8n workflows (`n8n-cli`)").
- **`fnb-stack-spec/SKILL.md`** — both per-app-spec-tree passages (`apps/agent-app` /
  `agentic-workflow-engine/` → n8n + `n8n-parallel-engine/`+`agentic-decommission/`; asset-scan
  "agentic engine" → n8n).
- **`fnb/SKILL.md`** — the skills menu: the retired `claude-agent-sdk` row (#11) was redundant with
  the existing `n8n-cli` (#18); consolidated to a single `n8n-cli` row at the engine's #11 slot and
  renumbered contiguously 10–18; footer "Retired reference" pointer fixed to n8n / skill #11.
- **`new-db-package/SKILL.md`** — ordering note (`fnb-agent` → `fnb-n8n` precedes
  `fnb-notify`/storage/…).
- **`sqitch-expert/SKILL.md`** — db/ tree diagram (removed `fnb-agent`/`agent_worker`/`agent_fn`,
  added `fnb-notify` + `fnb-game`, fixed the "must precede" note to `fnb-n8n`).
- **`fnb-acquire-dataset/SKILL.md`** — dataset-key env target (`worker-app` service →
  `n8n` service / `n8n/credentials/*.tpl`; `sync-<name>` workflow reads it) and the related-skills
  list (`graphile-worker-expert` "sync task handler" → `n8n-cli`).
- **`graphile-worker-expert/SKILL.md`** — kept LEGACY, but its "what replaced it" pointers
  (frontmatter description + body banner) fixed from `apps/agent-app`/`claude-agent-sdk`/
  `agentic-workflow-engine/` to n8n / `n8n-cli` / `n8n-parallel-engine`+`agentic-decommission`.

**Verified:** the retired-term grep (agent-app/fnb-agent/agent_worker/agent_fn/
agentic-workflow-engine/claude-agent-sdk/dual-engines/parallel-n8n/worker-app) is now **empty**
across all `.claude/skills/*/SKILL.md`. Doc-only — no build impact.
