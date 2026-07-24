# vue-flow-expert: 609-line body should split into references/

> **Execution Directive:** plan + execute this via `/fnb-stack-spec <this-file>` (skill
> governance). Doc-only. Never run `git`.

**Category: skills · Severity: LOW**

## Problem

`vue-flow-expert/SKILL.md` is a 609-line body with a single `references/` file
(`elkjs-layout.md`) — the inverted ratio of the house model for technology references:
`zitadel-expert` (50-line body, 7 refs) and `pgtap-expert` / `postgraphile-5-expert` /
`terraform-export` all keep a thin body holding a decision guide that names reference files
loaded per-topic. A 600-line body is loaded whole on every invocation and dilutes attention
(0060 checklist item 4) — for a skill that is currently a **generic reference with zero
in-repo consumers** (the wf UOW canvas retired 2026-07-17).

Found by the first `0060_recur__skill-effectiveness-audit` run (2026-07-23).

## Remediation

Restructure to the zitadel shape: body keeps the overview, quick-start, and a decision guide;
bulk content moves to `references/` files (suggested split: core-setup + nodes-and-edges,
composables-and-events, built-in-components, custom-components; `elkjs-layout.md` already
exists). Content is fine — only the packaging changes. No map/menu edits needed.

## Acceptance

- Body well under ~150 lines with a decision guide naming every reference file.
- No content lost (every section of the old body findable in a named reference).
- Frontmatter description unchanged (triggers were audited clean).
