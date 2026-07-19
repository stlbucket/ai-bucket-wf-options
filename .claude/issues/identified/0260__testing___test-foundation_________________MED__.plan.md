# Plan: Zero tests repo-wide — establish a test foundation (db-access utils, mappers, RLS smoke suite)

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/test-foundation.plan.md`
> Gate is `pnpm build`; add `pnpm test` (turbo) as a second gate once suites exist.
> Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: MEDIUM** (foundation; enables catching the WS2 class of bug) · Workstream: WS5 · Identified: 2026-07-05

## Details

There are **zero tests** anywhere in the repo — no `*.spec.ts`/`*.test.ts`, no `src/tests/` dir in
any package or app — despite:
- Every compiled package declaring `"test": "vitest run"` (fnb-types, db-access, graphql-client-api,
  auth-ui, auth-server).
- The implementor skill documenting a full testing convention (tests in `src/tests/`, `*.spec.ts`
  naming, per-package `vitest.config.ts` shapes).
- `graphql-client-api` lacking even a `vitest.config.ts` (`graphql-client-api-consistency.plan.md`).

The audit found several bugs a modest test suite would have caught immediately — e.g. the
`msg_tenant` "policies created but RLS not enabled" copy-paste bug (S6), the
`jwt.has_all_permissions` undeclared-variable bug (S11), `camelCaseKeys`/`normalizeClaims` edge cases.

## Implication

No regression safety net. Every WS1–WS4 fix in this audit lands unverified except by manual smoke.
The RLS gaps in particular (the most dangerous findings) are exactly what an automated policy test
suite exists to prevent from ever shipping. Without tests, the next migration can silently re-open a
closed hole.

## Suggested fix (start small, high-value)

Pick the three highest-leverage suites, following the skill's testing convention (`src/tests/
**/*.spec.ts`, per-package `vitest.config.ts`):

1. **db-access unit tests** (`packages/db-access/src/tests/`): pure functions with no DB —
   `camelCaseKeys` (nested `modules[]`/`tools[]` snake→camel), `normalizeClaims` (uppercasing
   `profileStatus`, and confirm it's made non-mutating per `fn-schema-grant-bypass`/audit note),
   `buildJwtPayload` (the exact `user_metadata` shape the SQL helpers parse). Fast, deterministic,
   guards the claims boundary.
2. **graphql-client-api mapper tests** (`packages/graphql-client-api/src/tests/`): each
   `to<Entity>(fragment)` mapper — un-Maybe, scalar coercion (UUID→string, Datetime→Date), enum
   pass-through. Add the msg/profile-claims mappers from `graphql-client-api-consistency.plan.md`
   and test them. Add the missing `vitest.config.ts` here as part of this.
3. **RLS/policy smoke suite** (the one that would have caught S1/S6): a pgTAP suite (or a
   node+pg integration test run against a deployed dev DB) asserting, for every module table:
   (a) `relrowsecurity = true`; (b) as `anon`, tenant-scoped selects return zero rows / writes are
   denied; (c) with tenant-A claims set via `set_config('request.jwt.claims', ...)`, only tenant-A
   rows are visible; (d) `_fn` SECURITY DEFINER functions are not directly executable by
   anon/authenticated. This suite doubles as the verification harness for WS2. Decide the harness
   with the user (pgTAP requires the extension; a TS integration test reuses the existing pg tooling
   in `scripts/`).

Wire `pnpm test` (turbo) to actually run something, and add `passWithNoTests` configs where a
package legitimately has none yet so `turbo run test` stays green. Update the implementor skill's
testing section if the chosen RLS-harness approach becomes a documented convention (R21).

## Verification

- `pnpm test` runs and passes; `turbo run test` green across the workspace.
- The RLS smoke suite **fails** against the current (pre-WS2) DB on the known gaps (wf no RLS,
  msg_tenant), proving it detects them — then passes after WS2 lands. (Order-of-operations: this
  suite is most valuable written before/alongside WS2 so it validates the fixes.)
- New tests live in `src/tests/**/*.spec.ts` per convention; each package with a `test` script has a
  `vitest.config.ts`.
