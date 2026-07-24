# Load-bearing skills live outside the repo (n8n-cli, vue-use-expert)

> **Execution Directive:** plan + execute this via `/fnb-stack-spec <this-file>` (skill
> governance). Doc-only unless the vendoring option is chosen. Never run `git`.

**Category: skills · Severity: LOW**

## Problem

Two skills the fnb system routes to are **global** (`~/.claude/skills/`), not in the repo:

- `n8n-cli` — the operator loop for the **sole workflow engine** (R22). `skill-map.md`,
  `/fnb` menu entry #11, and both orchestrators route to it.
- `vue-use-expert` — menu entry #14, map row present.

Both are honestly labeled "(global skill)" in the map/menu, so this is not a routing-integrity
defect — it is a **portability** one: on any other checkout, machine, or CI runner the route
resolves to nothing, silently. The vendored DO bundle shows the house already has a pattern
for external skills (`skills-lock.json` + `.agents/skills/` symlinks); these two predate it.

Found by the first `0060_recur__skill-effectiveness-audit` run (2026-07-23), checklist item 2.

## Remediation options

1. **Vendor `n8n-cli`** into the repo (own it, or pin via the `skills-lock.json` mechanism if
   it has an upstream). It is load-bearing for R22 and deserves repo residency.
2. **Document the dependency** — a bootstrap note (README or monorepo-bootstrap spec) listing
   required global skills and where to get them. Cheaper; leaves the silent-failure mode.

`vue-use-expert` is low-stakes either way (generic tech reference; nothing breaks without it).

## Acceptance

- A fresh checkout either resolves the `n8n-cli` route or fails loudly with instructions.
- `skill-map.md`'s "(global skill)" annotations match wherever the skills end up.
