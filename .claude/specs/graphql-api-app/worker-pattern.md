---
name: graphql-api-app-worker-pattern
description: TOMBSTONE — graphile-worker and the wf module are retired. The stack's workflow engine is n8n (R22); see .claude/specs/n8n-parallel-engine/ + .claude/specs/agentic-decommission/.
metadata:
  type: reference
---

## Status
**Retired** — the graphile-worker runner (`apps/worker-app`) + the `wf` module (`db/fnb-wf`) were
decommissioned 2026-07-17, replaced briefly by an agentic engine (`apps/agent-app`), which was
itself retired 2026-07-21 (agentic-decommission) once every workflow moved to n8n.

The current system:

- **Spec:** `.claude/specs/n8n-parallel-engine/` (standup) + `.claude/specs/agentic-decommission/`
  (the migration + retirement of the agentic engine)
- **Rule:** `global-rules.md` → **R22** (n8n is the sole workflow engine)
- **Engine:** the **n8n** container trio (`n8n-db-init` / `n8n-import` / `n8n`, custom image);
  definitions as code in `n8n/workflows/*.json`; state in the separate `n8n_engine` DB
- **Run log:** `n8n.workflow_run` (`db/fnb-n8n`); step-level record = the n8n editor's execution log
- **App trigger surface:** the `triggerWorkflow` extendSchema plugin — see `server-pattern.md`

Nothing in this file applies to the current stack.
