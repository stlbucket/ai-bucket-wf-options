# Plan: Unpinned dependencies (`latest`/`*`) and stale unused `fnb-db-access` deps

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/dependency-pinning.plan.md`
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: LOW-MEDIUM** (non-reproducible builds; layering) · Workstream: WS4 · Identified: 2026-07-05

> **Cross-ref (2026-07-09):** item 2 (unused `fnb-db-access` deps) is also covered by
> `workspace-dep-integrity` (0220) / `.claude/specs/workspace-dependency-integrity-pattern.md`
> Remediation C — whichever executes first does it; the other skips it.
> **Update (0220 executed 2026-07-09):** 0220 deliberately SKIPPED the `fnb-db-access` purge —
> item 2 still belongs to this plan. Run `pnpm dep-audit` after: the purge should not introduce
> missing declarations.
> **Update (2026-07-09):** item 1 (floating specifiers) is SUPERSEDED by the pnpm-catalog policy —
> "Version alignment — pnpm catalog" (Draft) in
> `.claude/specs/workspace-dependency-integrity-pattern.md`. The drift is wider than stated below
> (`@vueuse/core: "latest"` in all 6 apps + auth-layer + auth-ui; `typescript`/`vitest: "*"` in
> the 5 compiled packages). This plan now covers **item 2 only**; do not hand-pin item 1's
> specifiers — implement the catalog spec instead.
>
> **RESOLVED (2026-07-09, later the same day):** both remaining threads are done in one pass —
> the catalog spec was implemented (21-entry default catalog in `pnpm-workspace.yaml`, all
> manifests on `catalog:`, zero lockfile version movement, `dep-audit` extended with the two
> hard-fail checks) and item 2 landed (`fnb-db-access` removed from `graphql-client-api` and
> `auth-ui` manifests + auth-ui's stale rollup `external` entry; zero imports confirmed by grep;
> `pnpm build` 12/12 green, `pnpm dep-audit` clean). Verification criteria below all pass.
> User ran the Docker `down && up` cycle (2026-07-09); read-only boot check passed — all 15
> services up, zero module-resolution errors in app logs, nginx routes + GraphQL responding.
> Moved to `addressed/` with user sign-off.

## Details

1. **Unpinned versions:** `packages/auth-ui/package.json` and `packages/auth-layer/package.json`
   declare `@vueuse/core: "latest"` and `vue: "*"` (or similar floating specifiers), while the rest
   of the repo pins consistently (`vite ^8.0.8`, `nuxt ^4.4.2`, `@nuxt/ui ^4.6.1`). Floating specs
   mean a fresh `pnpm install` can resolve different versions than the committed lockfile intends.
2. **Stale unused workspace deps:** both `packages/graphql-client-api/package.json` and
   `packages/auth-ui/package.json` declare `"@function-bucket/fnb-db-access": "workspace:*"`, but
   **neither package imports db-access** anywhere in `src/` (grep confirms zero imports). For
   graphql-client-api this is a layering concern — the client data package shouldn't runtime-depend
   on the raw-pg root of trust. `auth-ui` correctly imports `ProfileClaims` from
   `@function-bucket/fnb-types`, not db-access, so its db-access dep is pure dead weight.

## Implication

Floating `latest`/`*` pins make the auth UI/layer builds non-reproducible — a transitive bump could
change behavior between two installs of the same commit. The unused db-access deps pull the raw-pg
package into the client dependency graph (bundler/resolution surface it shouldn't touch) and muddy
the layering the specs are careful about (`package-layers-pattern.md` dependency-direction diagram).

## Suggested fix

1. Pin `@vueuse/core` and `vue` in auth-ui/auth-layer to caret ranges matching the rest of the repo
   (read the resolved versions from `pnpm-lock.yaml` and pin to those majors). `vue` should match
   the Nuxt-provided version; prefer declaring it as a peer where appropriate.
2. Remove `@function-bucket/fnb-db-access` from `graphql-client-api` and `auth-ui` `package.json`
   dependencies (confirm zero imports first with `grep -rn "fnb-db-access" packages/graphql-client-api/src packages/auth-ui/src`).
3. `pnpm install` at root to update the lockfile — **this changes `node_modules`; Docker uses named
   volumes, so ask the user to restart** (`docker compose down && up`) per project memory, then
   verify read-only.
4. Sweep for any other `latest`/`*`/`"^0.0.0"`-style specifiers across all package.jsons while here
   (`grep -rn '": "\(latest\|\*\)"' packages/*/package.json apps/*/package.json`).

## Verification

- No `"latest"` or `"*"` version specifiers remain in package manifests.
- `graphql-client-api` and `auth-ui` no longer list `fnb-db-access`; both still build
  (`pnpm -F @function-bucket/fnb-graphql-client-api build`, `pnpm -F @function-bucket/fnb-auth-ui build`).
- `pnpm build` green; user restarts Docker; apps boot (no missing-dependency resolution error).
