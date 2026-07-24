# fnb-stack-implementor restates stack truth it claims not to restate

> **Execution Directive:** plan + execute this via `/fnb-stack-spec <this-file>` (skill
> governance — R21: any stack-truth relocation updates the pattern files + both orchestrators
> in the same change). Doc-only. Never run `git`.

**Category: skills · Severity: MED**

## Problem

`fnb-stack-implementor/SKILL.md` opens with "The stack is described once, in the pattern
files — this skill does not restate it inline," then carries ~250 lines of stack
*description* (not procedure): the Security Model section (roles + the 6-step session/claims
flow duplicating `graphql-api-pattern.md` → Auth Context), the Data Model entity tables,
residency rules, and support-mode summaries. This is the known drift zone — the R22 engine
swap had to chase stale restatements here (`addressed/0380__skills____agent-engine-r22-drift`),
and every architecture change pays the double-maintenance tax (R21) across ~700 lines.

Found by the first `0060_recur__skill-effectiveness-audit` run (2026-07-23), checklist item 3
(orchestrator altitude).

## Remediation — pick one deliberately

1. **Trim to altitude** — reduce Security Model / Data Model / residency to a pointer plus the
   minimal quick-reference the checklists actually consume (permission-key table, the 2-arg
   `withClaims` rule, `_api`→`_fn` templates); everything narrative points at
   `graphql-api-pattern.md` and the `read-these/` docs.
2. **Bless the duplication** — keep the curated quick-reference but delete the false "does not
   restate" claim and add an explicit banner: these sections are R21-propagation surfaces,
   updated in the same change as the pattern files.

Either resolves the defect; the current state (claim contradicts content) is the bug.

## Coordination

`identified/0240__skills____fnb-stack-implementor-enrich__MED__.plan.md` also targets this
skill's content. Resolve the two together in one governance pass so enrichment doesn't deepen
the restatement this item removes.

## Acceptance

- The skill's self-description matches its content (no false "does not restate" claim).
- Any retained stack description is explicitly marked as an R21 propagation surface, or gone.
- `0050_recur__skill-drift-reconciliation`'s next run has strictly fewer surfaces to check.
