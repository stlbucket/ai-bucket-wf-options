---
name: graphql-api-app-worker-pattern
description: TOMBSTONE — graphile-worker and the wf module are retired (2026-07-17). The stack's workflow engine is the agentic apps/agent-app; see .claude/specs/agentic-workflow-engine/.
metadata:
  type: reference
---

## Status
**Retired 2026-07-17** — the graphile-worker runner (`apps/worker-app`), the `wf` module
(`db/fnb-wf`), and every task handler this file described were decommissioned when the
**agentic workflow engine** replaced them (full-replacement decision, plan
`0015__wf________agentic-workflow-engine_________MED__`).

The successor system:

- **Spec:** `.claude/specs/agentic-workflow-engine/` (README + `_shared.data.md` +
  `infrastructure.md` + per-workflow files + `decommission.data.md`)
- **Rule:** `global-rules.md` → **R22** (agent-app is the stack's only workflow engine)
- **Engine:** `apps/agent-app` — headless Claude Agent SDK harness
  (`server/lib/agent-harness.ts`), workflow definitions as code
  (`server/lib/agent-workflows/`), closed zod-validated toolboxes
  (`server/lib/agent-tools/`), croner scheduler + reaper (`server/plugins/agent-scheduler.ts`)
- **Run log:** `agent.workflow_run` (`db/fnb-agent`); step-level record = per-run transcript
  JSONL on the `agent-transcripts` volume
- **App trigger surface:** the `triggerWorkflow` extendSchema plugin — see `server-pattern.md`

Nothing in this file applies to the current stack.
