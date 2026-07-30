# Plan: Workspace dependency integrity (R24) — missing declarations, per-layer TS projects, dep-audit gate

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor <this-file>` — read
> `.claude/specs/workspace-dependency-integrity-pattern.md` in full first; it is the spec this
> plan executes and this plan does not restate it.
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: MED** (IDE-only TS errors in layers; workspace hygiene) · Identified: 2026-07-09

## Details

Audit (2026-07-09) found two causes of IDE-only TypeScript errors, both specified in
`.claude/specs/workspace-dependency-integrity-pattern.md` (global-rules **R24**):

1. **Missing dependency declarations** — 6 violations across 4 manifests: `h3` undeclared in
   `packages/auth-layer`, `packages/tenant-layer`, `apps/graphql-api-app`; `vue` undeclared in
   `apps/graphql-api-app`, `apps/tenant-app`; `@function-bucket/fnb-types` undeclared in
   `apps/graphql-api-app`. pnpm is fully isolated (no hoisting) — these resolve only through
   bundler leniency.
2. **Layers are not TypeScript projects** — none of the four Nuxt layers has a `tsconfig.json`,
   `.nuxt`, or `nuxt prepare` step, so the IDE has no auto-import/`#imports`/Nuxt UI type
   context for layer files. This is the change that actually removes the phantom errors.

Plus dead declared deps (spec Remediation C): the retired-stack set in `apps/auth-app`
(`kysely`, `postgraphile`, `graphile`, `grafserv`, `graphql-ws`, …), the postgraphile set in
`apps/tenant-app`, `pg`/`@types/pg`/`fnb-db-access` in msg-app/storage-app, and
`consola`/`pg`/`@types/pg` in storage-layer.

## Implication

Every layer file shows phantom IDE errors, masking real ones; undeclared deps are one lockfile
churn away from breaking; the dead auth-app/tenant-app deps drag a retired GraphQL-server stack
into UI-app dependency graphs.

## Suggested fix

Execute the spec's Implementation Order (§Implementation order) exactly:

1. **Remediation A** — add the 6 missing declarations (`h3` at `^1.15.11` to match the root
   pnpm override); `pnpm install`.
2. **Remediation B** — per-layer `tsconfig.json` (app-style `.nuxt` references) +
   `dev:prepare`/`postinstall: nuxt prepare` scripts in all four layers; run prepare per layer;
   confirm IDE errors gone in layer files. A must land before/with B.
3. **Remediation C** — purge confirmed-dead deps; convert storage-layer `server/` to explicit
   `h3` imports; work the verify-before-purge list one item at a time (`pnpm build` after each).
   **Overlap:** item `0280__infra_____dependency-pinning` already covers the
   `fnb-db-access` purge from `graphql-client-api`/`auth-ui` and the `latest`/`*` pinning sweep —
   either fold 0280 into this pass (ask the user before moving it to `addressed/`) or skip those
   two entries here and leave them to 0280.
4. **Enforcement** — port the audit prototype to `scripts/dep-audit.ts` (tsx, exits non-zero on
   missing declarations only; allowlist per spec) + root `dep-audit` script.
5. **Docs (R21)** — fix the two stale `package-layers-pattern.md` dep lines (auth-ui and
   graphql-client-api → db-access) and add the self-preparable-layer convention to its Nuxt
   Layers section. R24 + skill pointers already landed with the spec.
6. Ask the user to run `docker compose down && docker compose up` (new deps → named
   `node_modules` volumes), then verify read-only.

## Verification

- `pnpm build` green after every manifest change.
- Opening `packages/*-layer/app/**` and `server/**` files in the IDE shows no unresolved
  auto-imports / `h3` / `@nuxt/ui` type errors.
- `pnpm dep-audit` exits 0 (no missing declarations anywhere).
- No `kysely`/`postgraphile`/`grafserv`/`graphql-ws` in any UI-app manifest.
- After the user's Docker cycle: all apps boot, no `does not provide an export named` /
  missing-module resolution errors at startup.
