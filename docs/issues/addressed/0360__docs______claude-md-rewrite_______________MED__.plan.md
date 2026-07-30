# Plan: Root CLAUDE.md describes the pre-migration template repo, not the actual monorepo

> **Execution Directive:** Implement via the `fnb-stack-spec` skill (docs governance).
> Invoke: `/fnb-stack-spec .claude/issues/identified/claude-md-rewrite.plan.md`
> Doc-only change; no build impact. Never run `git`; commits are human-only.

**Severity: HIGH** (loaded into every session) · Workstream: WS1 (skills & specs) · Identified: 2026-07-05

## Details

`CLAUDE.md` at the repo root describes a state that no longer exists:

- *"apps/fnb-auth-app … apps/fnb-tenant-app"* — those apps don't exist. Reality: `auth-app`,
  `home-app`, `tenant-app`, `msg-app`, `graphql-api-app` (5 apps).
- *"packages/fnb-auth-core — Shared TypeScript utility library (exports `ping()`)"* — retired.
  Reality: 8 packages (`fnb-types`, `db-access`, `graphql-client-api`, `auth-ui`, `auth-server`,
  `auth-layer`, `tenant-layer`, `msg-layer`).
- *"db/fnb-auth/ — Empty placeholder for future database work"* and *"No database integration yet
  (empty db/ dir)"* — reality: 8 sqitch packages (fnb-auth, fnb-app, fnb-msg, fnb-todo, fnb-loc,
  fnb-wf, fnb-storage, + my-app cruft) with a full RLS/permission model.
- *"Ping.vue … live demo of the shared fnb-auth-core package"* — gone.
- Tech-stack section omits the entire data stack (PostGraphile 5, urql, graphql-codegen,
  graphile-worker, the layer inheritance).

Accurate/keep: the pnpm+turbo+Nuxt 4 framing, the ESLint-broken note, the memory-location note, the
"never run git during a sqitch session" rule.

## Implication

CLAUDE.md is injected into **every** session's context. A model starting cold is told the repo is a
2-app template with no database — the opposite of reality. This actively misleads every task and
wastes context re-deriving the truth. Highest-leverage single doc fix in the repo.

## Suggested fix

Rewrite CLAUDE.md to describe the real monorepo, staying concise (it's always-loaded context — link
out rather than inline):

1. **Structure:** the 5 apps (with nginx path + which layer each extends), the 8 packages (one line
   each), the 8 db packages. Point at `.claude/specs/package-layers-pattern.md` for detail rather
   than restating.
2. **Data stack:** one paragraph — DB (RLS + `<module>_fn`/`<module>_api`) → PostGraphile 5 →
   graphql-client-api (urql + codegen) → composable re-export → Vue. Point at
   `.claude/specs/graphql-api-pattern.md`.
3. **Auth model:** one paragraph — session cookie (root of trust) → claims → pgSettings → RLS;
   claims in localStorage client-side. Point at the security section of the specs.
4. **Conventions to keep:** memory in `.claude/memory/`, specs in `.claude/specs/`, issues in
   `.claude/issues/`, `pnpm build` is the gate (lint known-broken), never `git` during sqitch, never
   commit (human-only), never rebuild env (ask user).
5. **Do NOT restate the stack in full** (global-rules R21) — CLAUDE.md points to specs; specs are
   the single source. Keep it a map, not a manual.
6. Cross-check against `.claude/specs/monorepo-bootstrap-pattern.md` so the two agree.

## Verification

- Read-through: every app/package/db-package named in CLAUDE.md exists (`ls apps packages db`).
- No reference to `fnb-auth-app`, `fnb-tenant-app`, `fnb-auth-core`, "no database yet", or `Ping.vue`
  remains (`grep -i 'fnb-auth-core\|fnb-auth-app\|no database\|Ping.vue' CLAUDE.md` → empty).
- Length stays modest (always-loaded); links resolve to real spec files.
