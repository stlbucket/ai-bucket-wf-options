---
name: fnb-stack-implementor
description: >
  Full-stack implementor for the fnb monorepo: executes specs/plans across DB → PostGraphile →
  graphql-client-api (urql) → composable re-export → Vue page. Use for any feature, page,
  GraphQL operation, component, or module that touches more than one layer of the stack.
---

# fnb Stack Implementor

You execute specs across the full fnb stack. **This skill holds the sequence and the gates —
nothing else.** The stack is described once, in the pattern files; the per-topic payloads live
in this skill's `references/` directory, loaded when the decision guide below says so.

## Required reading (once per session, before any code)

- `docs/specs/global-rules.md` — R1–R24, enforced across all modules
- `docs/specs/graphql-api-pattern.md` — the canonical data stack (DB → PostGraphile → urql/
  graphql-client-api → composable re-export → Vue) + the REST/H3 carve-outs + auth context
- `docs/specs/package-layers-pattern.md` — the ten packages + codegen workflow
- `docs/specs/ui-components-rules.md` — UC1–UC15

Do not re-describe the stack from memory — cite these. The monorepo layout, security model,
data model, and residency/support-mode rules live in those files (+ `AGENTS.md` for the app/DB
map); this skill deliberately does not restate them.

## Non-negotiables

- **Nuxt UI v4 only — never v3 API.** When in doubt, check existing components under
  `apps/tenant-app/app/components/`; do not trust pre-v4 training data or docs. UTable columns:
  UC15.
- **Three barrels** (`fnb-types`, `db-access`, `graphql-client-api` `src/index.ts`) crash the
  app at startup when a line is missing — verify after every added file
  (`references/special-cases.md`).
- Never run `git`; never rebuild/restart the env yourself — ask the user, then verify read-only.

## Decision guide — read the reference when the step comes up

| Read | When |
|------|------|
| `references/new-feature-checklist.md` | building any new feature/module (DB → UI, steps 1–6, incl. RLS/`_api` templates + permission keys) |
| `references/rest-to-graphql-conversion.md` | a page still runs on Nitro REST + `useFetch` (legacy; spec Mode 4 companion) |
| `references/key-file-paths.md` | you need the exact path for an auth/session/codegen/nav file, or a `→ [xx]` deep-reference code |
| `references/special-cases.md` | touching auth, sessions, barrels, mappers, licenses — or anything that "looks like cleanup" |
| `references/testing-conventions.md` | adding/naming package tests or a `vitest.config.ts` |

**Specialist skills:** this skill owns the *sequence*; the *how* for each layer lives in
specialist skills routed by `.agents/skills/skill-map.md` — read the named `SKILL.md` (and the
reference files its decision guide names) before the step. The checklist marks the routing
inline (`→ skill fnb-db-designer`, `sqitch-expert`, `new-db-package`, `fnb-create-app`,
`postgraphile-5-expert`); anything unnamed — n8n workflows (`n8n-cli`), ZITADEL/OIDC
(`zitadel-expert`), Vue Flow (`vue-flow-expert`), VueUse (`vue-use-expert`) — consult the map.

## Spec required — the entry gates

**Always ask for the spec if none was provided.** Implementation is driven by `.ui.md` /
`.data.md` files under `docs/specs/` (the containing directory is enough).

**[FILL IN] gate:** if any `[FILL IN]` marker or unchecked **Open Questions** item remains in
the spec, stop and ask the user to resolve it. Never guess.

**Two entry points** (user directive 2026-07-09):
- **A plan file** (`docs/issues/**/*.plan.md`, via its Execution Directive) → execute it.
- **A spec README** (via its Execution Directive — every spec dir has one) → **first author the
  plan file**: derive a numbered `docs/issues/identified/` plan (R23 naming + self-referential
  Execution Directive) from the README's Implementation Task List, sequenced with verified code
  anchors. Then ask the **go/no-go question** — explicit yes/no (AskUserQuestion in Claude
  Code), never a soft prompt:

  > **Plan created at `<path>`. Execute it now?** — Yes / No

  Yes → run the plan in this session. No → stop; the plan file's own Execution Directive is the
  durable entry point.

## Completion hand-off — required final step (user directive 2026-07-09)

When a plan finishes executing (implementation complete and verified), end with an explicit
yes/no question (AskUserQuestion; memory `feedback_ask_before_moving_addressed`):

> **`<plan-file>` is fully executed and verified. Move it to `docs/issues/addressed/`?** — Yes / No

- **Yes** → move the file (filename unchanged — status is the directory, never the name; R23).
- **No** → leave it and note what the user wants to see first.

Never move a plan to `addressed/` without this question, and never end a completed run without
asking it.
