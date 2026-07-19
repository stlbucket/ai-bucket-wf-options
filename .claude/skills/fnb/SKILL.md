---
name: fnb
description: >
  The fnb skill directory — a human-facing menu of every skill in this repo, in order of
  importance, with what each does and when to invoke it. Use when the user types /fnb, asks
  "what skills are there?", "which skill should I use for X?", or wants an overview of how the
  skill system fits together. This skill only presents the menu — it performs no work itself.
---

# /fnb — Skill Directory

Present the table below to the user (formatted, not raw markdown). If they name a task, point
them at the right skill using the **Invoke it when…** column and the tiebreaks in
`.claude/skills/skill-map.md`. Do not start the work here — that's the pointed-at skill's job.

## The ones you actually drive

| # | Skill | What it is | Invoke it when… |
|---|-------|-----------|-----------------|
| 1 | **fnb-stack-spec** | Authors/updates the `.claude/specs/` contracts (ui/data page pairs, pattern files, global rules) | Starting anything non-trivial — spec before build. Also to reverse-engineer or reconcile specs. |
| 2 | **fnb-stack-implementor** | Executes a spec across the full stack: DB → PostGraphile → graphql-client-api → composable → page. Owns the checklists and failure signatures; routes to specialists per step. | Building any feature that touches more than one layer. Your default "go do it" skill. |
| 3 | **fnb-acquire-dataset** | Acquires an external API dataset end-to-end: recon → `<dataset>-expert` skill → spec → plan → build hand-off (the breweries shape). **Implicitly invokes #1** to author the spec, then hands to #2. | `/fnb-acquire-dataset <api-doc-url> <main-table>` — any time an outside dataset should become a Datasets tool. |

Day-to-day, these are the whole interface: spec it with #1, build it with #2, and #3 drives
both for the dataset case. Everything below is engaged *by them* as needed — direct invocation
is the exception, noted per skill.

## Project-procedure specialists

| # | Skill | What it is | Invoke it when… |
|---|-------|-----------|-----------------|
| 4 | **fnb-db-designer** | The DB dialect: schema trio (`<module>`/`_fn`/`_api`), `jwt.*` helpers, RLS tiers, license/permission model | Directly for pure DB questions ("how do we model X?", "what gates Y?"). Otherwise engaged by #1 (drafting `_shared.data.md`) and #2 (checklist step 1). |
| 5 | **sqitch-expert** | Sqitch mechanics: plan entries, numbering ranges, cross-project deps, deploy/revert/verify/rework | Directly for migration surgery (rework, tags, plan conflicts, status). Routine plan entries happen inside #2's flow — rarely needs a direct call. |
| 6 | **new-db-package** | Scaffolds a brand-new `db/<package>` + registers it in `DEPLOY_PACKAGES` | Directly, as a command: `/new-db-package fnb-<module>`. Then it hands off to #4. |
| 7 | **fnb-create-app** | Scaffolds a brand-new `apps/<slug>-app` (package.json, nuxt.config, compose service, nginx) | Directly when adding an app, or engaged by #2 at checklist step 6. Ends at the running skeleton. |
| 8 | **true-up-sqitch-package** | Fills in missing revert/verify files and plan entries for an existing package | Directly, occasionally — a repair tool, not part of any flow. |
| 9 | **function-bucket-legacy-ui-converter** | Migrates UI from the legacy Nuxt 3 function-bucket project (scout + convert modes) | Directly only. A standalone workflow — no orchestrator engages it. |

## Technology references (almost never invoked directly)

These exist to be *read* mid-task — #2/#3 and the procedure skills route to them. Invoke one
directly only for a pure "how does this technology work?" question.

| # | Skill | Covers |
|---|-------|--------|
| 10 | **postgraphile-5-expert** | PostGraphile 5 config, smart tags/behaviors, grafast context, path-prefix deployment, schema-design-for-GraphQL |
| 11 | **claude-agent-sdk** | The agent-app workflow engine (R22): `query()` options, custom toolboxes, toolbox closure, harness patterns, live-run gotchas |
| 12 | **zitadel-expert** | The OIDC ceremony, ZITADEL org/project/app config, service accounts, token validation, self-hosting |
| 13 | **vue-flow-expert** | Vue Flow canvases (nodes/edges/composables) + elkjs auto-layout (generic — no in-repo consumers since the wf dashboard retired) |
| 14 | **vue-use-expert** | VueUse composables for reactive/browser/DOM utility needs (user-level skill) |
| 15 | **breweries-expert** | Open Brewery DB API — endpoints, filters, sort syntax, brewery types, response schema (the first `<dataset>-expert` produced by #3) |
| 16 | **airports-expert** | OurAirports dataset — seven bulk CSVs (no API), live column lists/enum vocab/nullability, parsing gotchas (produced by #3) |

## How it fits together

```
you ──> /fnb (this menu)
you ──> fnb-stack-spec ──────┐ authors the contract
you ──> fnb-stack-implementor ┘ executes it, engaging #4–#15 per step
you ──> fnb-acquire-dataset ──> recon, then implicitly invokes #1 (spec) and hands to #2 (build)
routing rules + tiebreaks: .claude/skills/skill-map.md
```

**Maintenance:** when a skill is added or retired, update this menu AND `skill-map.md` in the
same change (global-rules R21). This file ranks and describes; skill-map routes.
