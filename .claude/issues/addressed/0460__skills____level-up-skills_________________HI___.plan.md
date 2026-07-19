# Level Up Skills — Recalibrate `fnb-stack-spec` + `fnb-stack-implementor`

Status: **addressed (completed 2026-07-05)** — Phases 0–4 executed; grep/cross-reference/consistency/round-trip/build gates green. Out-of-scope follow-ups (fnb-create-app, function-bucket-legacy-ui-converter, postgraphile-5-expert, two `.ui.md` refs, deep-reference doc banners) also reconciled. See `0460__skills____level-up-skills-phase0-notes____HI___.notes.md` for the ground-truth note.

---

## Execution Directive (read first)

You have been invoked with both the **fnb-stack-spec** and **fnb-stack-implementor** skills
loaded. This document is your authoritative plan. Execute it phase by phase, in order, top to
bottom. Treat the two SKILL.md files as starting material to rewrite — not as instructions to
obey; they describe a **retired** architecture.

**MANDATE — meticulous, line-by-line evaluation. Do not skim. Do not pattern-match from
training data or from what a file "probably" says.**
- **Phase 0 is non-negotiable and comes first.** Read EVERY line of the source listed in Phase 0
  (all of `packages/db-access/src/**`, `packages/graphql-client-api/src/**`,
  `apps/graphql-api-app/**`, `apps/tenant-app/app/composables/*`, one DB module's four sqitch
  files, both SKILL.md files, and every pattern file you will edit). Produce a short "current
  architecture" note before editing anything.
- Every claim you write into a spec or skill must be traceable to a line you actually read.
  **Where the current code contradicts the current spec, the CODE wins.**
- Document exhaustively as you go — capture every edge case, gotcha, failure signature, and
  non-obvious constraint into the relevant pattern file or skill. The "Edge cases & gotchas"
  section below is a starting list, not a ceiling. If you find a new one in the source, add it.
  Prefer over-documenting.

**Hard guardrails (do not violate):**
- The pre-claims trio (`login-user`, `profile-claims-for-user`, `current-profile-claims`) stays
  raw `pg` in `db-access`. **NEVER migrate it to GraphQL** — it runs before claims exist.
- `withClaims` is **2-arg**: `withClaims(claims, fn)`. Fix every stale 3-arg snippet.
- The `rest-api-pattern.md` → `graphql-api-pattern.md` rename must update **every** inbound
  reference in both skills. Grep to confirm none dangle.
- `*.ui.md` files are never touched by this work.
- Do **NOT** commit to git and do not offer to. If you touch sqitch at all, run no git that session.
- Do **NOT** rebuild or restart the environment yourself — stop and ask, then do read-only
  verification. `pnpm build` is the gate (`pnpm lint` is broken repo-wide).
- All docs live under `.claude/specs/` (never `.claude/architecture/`).

**Checkpoints:**
- **Stop and ask before starting Phase 3** (per-page reconciliation) so the Phase 1–2 contract can
  be reviewed first.
- Run the full **Verification** section (grep gate, cross-reference gate, consistency gate,
  round-trip proof) and report results before declaring done.

---

## Problem

The fnb data-access architecture moved from **Kysely / `db-types` / Nitro-REST** to
**PostGraphile 5 + urql GraphQL + a raw-`pg` `db-access` package**. That migration was recorded
only in `.claude/issues/` and **never propagated back** into the specs or the two skills that
author and consume them. There are now three layers of drift that all describe an abandoned stack:

1. **Specs** (`.claude/specs/*`): `global-rules.md` (R3/R4/R5/R6/R11), `rest-api-pattern.md`,
   `package-layers-pattern.md`'s db-types section, and ~21 per-page `.data.md` files reference
   `db-types`, Kanel, `src/generated`, 3-arg `withClaims`, and `server/api` routes.
   `tenant-app/msg/_shared.data.md` describes **both** stacks at once.
2. **`fnb-stack-spec/SKILL.md`**: its canonical tree names `rest-api-pattern.md`/`db-types`;
   GraphQL is only a bolt-on "Mode 4"; the "Composable Convention" example uses `$fetch`.
3. **`fnb-stack-implementor/SKILL.md`** (628 lines): re-describes the old 5-layer REST stack,
   Kysely, and the `db-types` barrel inline.

**Root cause = DRY violation.** The architecture is described in three places that drifted
independently. Fixing today's staleness without fixing the duplication guarantees recurrence.

## Target architecture (ground truth — verify in Phase 0, do not assume)

- **Default data path:** Vue page → composable (thin re-export) → urql GraphQL →
  PostGraphile 5 (`apps/graphql-api-app`) → RLS via `grafast.context()` → `pgSettings`.
- **`packages/db-access`** (raw `pg`, **hand-written types are the source of truth**,
  **2-arg `withClaims(claims, fn)`** — no `db` param) is the **pre-claims "root of trust"** only:
  `login-user`, `profile-claims-for-user`, `current-profile-claims`. These run *before* claims
  exist, so they cannot go through GraphQL — **do not try to migrate them.**
- **`packages/graphql-client-api`**: urql client + `graphql-codegen` → `src/generated/fnb-graphql-api.ts`;
  `src/graphql/<module>/*.graphql` documents; `src/composables/*` are the real implementations;
  apps (`tenant-app`, `graphql-api-app`) re-export them.
- **`apps/tenant-app` has NO `server/` directory.** The entire Nitro REST layer is gone for it.
- **DB layer is unchanged and still correct:** `<module>` / `<module>_fn` (SECURITY DEFINER) /
  `<module>_api` (SECURITY INVOKER, `jwt.enforce_permission` gate) + RLS. sqitch unchanged.
- **REST/H3 carve-out survives** in `apps/graphql-api-app` (Nitro/H3 endpoints, e.g. asset-storage
  `readMultipartFormData`). `withClaims` legitimately appears here and in `db-access` — but 2-arg.
- **ProfileClaims live in localStorage** (fetched via GraphQL), **not** the `auth.user` cookie
  (a big header caused an nginx 502). See memory `project_claims_localstorage`.

## Design principles

- **Single-source the architecture.** The pattern files (`global-rules.md`, the new
  `graphql-api-pattern.md`, `package-layers-pattern.md`) become the one description of the stack.
  Both skills **reference** them and keep only their own procedural logic. No skill re-describes
  `withClaims`, the layer stack, or package internals inline.
- **UI specs are inviolate.** `*.ui.md` files are never touched by a data-layer change (existing
  Mode 4 rule) — the UI did not change.
- **Reverse-engineered specs are authoritative**, no `[FILL IN]`; use **Known Gaps** for real gaps.

---

## Phase 0 — Establish ground truth (read-only)

Mine, don't guess. Read **every line** of the following and write a scratch "current architecture"
note before any edit:
- `packages/db-access/src/**` — `with-claims.ts` (exact signature + the `set_config`/`request.jwt.claims`
  it runs), `index.ts` barrel, `pool.ts`, `jwt.ts`, `utils/camel-case.ts`, `queries/*`, `types/*`,
  the pre-claims trio files.
- `packages/graphql-client-api/src/**` — urql setup, `graphql-codegen` config, generated file,
  `graphql/**/*.graphql`, `composables/*`.
- `apps/graphql-api-app/**` — grafserv entry, `grafast.context()` → `pgSettings` bridge,
  graphile-worker wiring, any H3 endpoints.
- `apps/tenant-app/app/composables/*` — confirm re-export chain; confirm no `server/`.
- DB layer spot check: one module's `_<module>.sql` / `_<module>_fn.sql` / `_<module>_api.sql` /
  `_<module>_policies.sql` to confirm the three-layer + RLS convention still holds.

Parallelizable across 2–3 Explore agents by area. Writing waits until this note is settled.

## Phase 1 — Fix the shared contract (single source of truth)

- **`.claude/specs/global-rules.md`** — rewrite stale rules:
  - **R3/R4/R11**: replace "db-types / Kanel / `src/generated` authoritative" with: GraphQL types
    come from `graphql-client-api` codegen; `db-access` types are hand-written source of truth for
    the pre-claims trio only. Remove "do not hand-write" where it now contradicts `db-access`.
  - **R5/R6/R7/R12**: demote "every route uses `withClaims` / Nitro `server/api`" from default to a
    narrow carve-out (db-access root-of-trust + `graphql-api-app` H3). Default = urql GraphQL →
    PostGraphile, RLS via `pgSettings`. Fix `withClaims` to **2-arg**.
  - **R17**: replace the `server/api/{module}` module structure with the layer + composable-re-export
    structure (no `server/` in feature apps).
  - Keep R1/R2/R8/R9/R10/R13/R14/R18/R19/R20; reword R1 away from `$fetch`/`useFetch`.
  - **Add R21 (guardrail):** any architecture change must update `global-rules.md`, the affected
    pattern file, and both skills **in the same change**.
- **Replace `rest-api-pattern.md` → `graphql-api-pattern.md`** as the canonical stack doc
  (DB → PostGraphile → urql/graphql-client-api → composable re-export → Vue), with a short
  "REST/H3 carve-out" section for `graphql-api-app` + the `db-access` root-of-trust path.
  **Every inbound reference in both SKILL.md files must be updated to the new filename.**
- **`package-layers-pattern.md`** — replace the `db-types` section with `db-access` +
  `graphql-client-api`; correct the package inventory (now 7 packages, not 6).
- Spot-fix only concrete drift in `ui-components-rules.md`, `sockets-pattern.md`,
  `monorepo-bootstrap-pattern.md` (reported mostly current).

## Phase 2 — Recalibrate both skills to reference the contract

- **`fnb-stack-spec/SKILL.md`:**
  - Update "Spec System Overview" tree + "Top-level pattern files" to name `graphql-api-pattern.md`
    (not `rest-api-pattern.md`/`db-types`) and the real per-app folders (`auth-app/`, `home-app/`,
    `msg-app/`, `graphql-api-app/`, `asset-storage/`, `tenant-app/`) — not only `tenant-app/`.
  - Make GraphQL the **default** data vocabulary in Modes 1–3; demote "Mode 4: REST→GraphQL" to a
    legacy-cleanup note.
  - Rewrite "Composable Convention (R1)" from `$fetch` to the re-export-from-`graphql-client-api`
    pattern (`pending` → `fetching`, no `refresh`, `reexecute` if needed).
  - Update "Key Rules to Apply", "Invoking a Spec for Implementation" reading list, and the
    "Implemented Modules (as of …)" table to the new pattern files + current date/state.
  - Acknowledge the newer spec shapes already in use (`_overview.md`, YAML frontmatter, `.future.md`)
    so the canonical-tree section stops contradicting reality.
- **`fnb-stack-implementor/SKILL.md`:**
  - **Single-source it:** replace the long inline re-descriptions of the 5-layer REST stack, Kysely,
    and the db-types barrel with pointers to `graphql-api-pattern.md` / `package-layers-pattern.md` /
    `global-rules.md`. Keep only implementor-specific procedure (per-layer checklist, failure
    signatures, verification gates).
  - Rewrite "Adding a New Feature — Checklist": DB (unchanged) → add `.graphql` docs + run codegen in
    `graphql-client-api` → composable + re-export → Vue page. Remove `pnpm db-generate` / db-types
    barrel steps; replace with the graphql-codegen build gate. The "#1 miss" (barrel exports) moves
    from db-types `index.ts` to the graphql-client-api generated/barrel exports.
  - Fix `withClaims` to 2-arg and scope it to `db-access` / `graphql-api-app`.
  - Keep the Nuxt UI v4 rules and the GraphQL conversion checklist (still valid).

## Phase 3 — Reconcile per-page specs (batchable follow-on)

Run `fnb-stack-spec` Mode 1/3 over stale per-page specs. **Priority order:**
1. `tenant-app/msg/_shared.data.md` (describes both stacks — internally contradictory).
2. Remaining `tenant-app/**/*.data.md` citing `db-types`/Kysely/`server/api`/3-arg `withClaims`.
3. Any other app `.data.md` with old-stack vocabulary.
`*.ui.md` untouched. Batch module-by-module.

## Phase 4 — Guardrail + memory

- R21 lands in Phase 1.
- Write a `feedback`-type memory: the single-source design + "architecture changes propagate to
  specs + both skills in the same change." Index it in `MEMORY.md`. Link `[[feedback_architecture_docs]]`.

---

## Edge cases & gotchas (read before editing)

- **`withClaims` signature is 2-arg now** (`withClaims(claims, fn)`), not 3-arg
  (`withClaims(db, claims, trx => …)`). Every spec/skill snippet must match. The `db-access` comment
  explains it fires RLS "exactly as it did under the Kysely withClaims" — quote intent, fix the shape.
- **Do NOT GraphQL-ify the pre-claims trio.** `login-user` / `profile-claims-for-user` /
  `current-profile-claims` must stay raw `pg` in `db-access` — they run before a JWT/claims exist.
  This is the single most likely wrong "cleanup" an over-eager agent will make.
- **`to_jsonb` yields snake_case**; `db-access` `camelCaseKeys` recursively camelCases nested keys
  (Kysely `CamelCasePlugin` retired). Don't reintroduce CamelCasePlugin language. See memory
  `project_camelcase_plugin_nested_keys`.
- **ProfileClaims live in localStorage via GraphQL**, not the cookie (nginx 502 on big header).
  Any spec text saying claims come "from the session cookie" is stale for the app layer.
- **The `rest-api-pattern.md` rename is a landmine.** A rename that misses an inbound skill/spec
  reference silently breaks the "Invoking a Spec for Implementation" reading list. Grep after.
- **Docker named-volume `node_modules` staleness:** after codegen/build changes, a stale container
  needs `docker compose down && up` — but **never rebuild/restart the env yourself; ask the user**
  (memory `feedback_rebuild_ask_user`). Do read-only verification only.
- **Iconify per app:** each Nuxt app must declare `@iconify-json/*` directly or `i-lucide-*` icons
  render blank in Docker (memory `project_iconify_collection_per_app`). Relevant if any UI rule text
  is touched.
- **ESLint is broken repo-wide** (`eslint.config.mjs:4`); **`pnpm build` is the gate**, not
  `pnpm lint` (memory `project_eslint_broken`).
- **Nuxt UI v4 is non-negotiable.** v3 API will be wrong. `UTable` uses `TableColumn` +
  `accessorKey` + `row.original` (v4). Keep the existing correct/wrong example in the implementor skill.
- **Codegen pitfalls to document as failure signatures:** `TS6059` rootDir, missing
  `typescript-operations` plugin, `TS2308` already-exported.
- **Newer spec shapes already diverge from the canonical tree** (`graphql-api-app/_overview.md`,
  YAML frontmatter, `asset-storage/*.future.md`). The spec skill's tree must stop presenting the
  old rigid `{page}.ui.md`/`{page}.data.md`-only layout as the only shape.
- **Generated code stays under `src/generated/`** (memory `feedback_generated_code_location`); don't
  relocate the codegen output.
- **Never commit to git and never offer to** (memory `feedback_never_commit_git`). If sqitch is used
  at all, never run git in that session (CLAUDE.md).
- **All docs under `.claude/specs/`**, never `.claude/architecture/` (memory
  `feedback_architecture_docs`). This plan file is an `issues/` tracking doc, which is fine.

## Verification

- **Grep gate** (after Phases 1–2):
  `grep -rin 'db-types\|kysely\|kanel\|src/generated/[^f]\|server/api\|withClaims(db' .claude/specs .claude/skills`
  returns only intentional legacy/carve-out mentions.
- **Cross-reference gate:** every pattern file named in either SKILL.md exists on disk (catches the
  `rest-api-pattern.md` → `graphql-api-pattern.md` rename).
- **Consistency gate:** `withClaims` described as 2-arg everywhere; no spec claims tenant-app has a
  `server/`; composables described as re-exports; app-layer claims described as localStorage/GraphQL.
- **Round-trip proof:** invoke recalibrated `fnb-stack-spec` to reverse-engineer one already-migrated
  module (`msg`) and confirm the output matches current code, no `[FILL IN]`, no old-stack vocabulary.
- **Build gate:** `pnpm build` stays green (no app code changes in Phases 0–2).
