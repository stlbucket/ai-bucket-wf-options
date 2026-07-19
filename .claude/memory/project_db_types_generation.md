---
name: project-db-types-generation
description: RETIRED — packages/db-types (Kysely/Kanel) is gone, replaced by db-access + graphql-client-api. Kept only for the barrel lesson.
metadata:
  type: project
---

> **RETIRED (as of the file-upload branch migration).** `packages/db-types` (Kysely/Kanel codegen)
> no longer exists. It was replaced by `packages/db-access` (raw pg root-of-trust + hand-written
> types) and `packages/graphql-client-api` (GraphQL codegen → `src/generated/fnb-graphql-api.ts`).
> There is no `pnpm db-generate` / kanel pass anymore — see `.claude/specs/graphql-api-pattern.md`
> and `package-layers-pattern.md`. The one lesson below that still applies (generalized): a missing
> barrel export in `db-access/src/index.ts` OR `graphql-client-api/src/index.ts` crashes the Node
> ESM loader at app startup (`does not provide an export named 'X'` at `dist/index.js`) — not a
> build error. Everything else here is historical.

## packages/db-types generation model (file-upload branch onward) — HISTORICAL

`kanel.config.ts` runs **one** `processDatabase` over **all** schemas (union of `db/db-config.ts`
`schemas`) into a single `src/generated/` tree with one `Database.ts`. `preDeleteOutputFolder: true`
wipes stale orphans each run. Loading every schema together lets kanel resolve cross-schema
references (composites like `app_fn.paging_options`, FKs to `app.tenant`) to real types.

**typeFilter — the key rule:** keep all tables/enums/composite types, but for routines keep
**only the `_api` layer** (`t.schemaName.endsWith('_api')`). The `_api` layer is the
permission-enforcing public surface; `_fn`/trigger routine types are internal noise **and** the
only cross-schema name collisions (`x_api.foo` vs `x_fn.foo`, `handle_update_profile` across
module `_fn`s). Verified against the live DB: with `_fn` routines dropped there are **zero**
collisions among the flat-exported names, so a flat "export everything" barrel is safe.

## Barrel layout (drift-proof)

- `scripts/db-generate.ts` (repo-root `scripts/`, run via `pnpm db-generate`) is fully data-driven:
  builds each `generated/<schema>/index.ts` from disk AND the aggregate `generated/index.ts`
  (`export * from './<schema>/index'` per schema), plus mutation-dir barrels.
- `src/index.ts` is **hand-maintained**: `export * from '@/generated'` + `Database`/`createDb` +
  queries + `with-claims` + mutation namespaces (`appApi`/`appFn`/`authFn`/`msgApi` — aliases
  can't be derived from disk). New generated schemas flow in automatically; new queries/mutations
  must be wired here by hand. `db-generate` **must not** rewrite `src/index.ts` (an old step 4 did
  and silently dropped exports → ESM startup crash). See [[feedback-explicit-imports-in-layers]].

## Gotchas

- `dist` uses vite `emptyOutDir: false`, so stale `dist/generated/*` can linger after restructures
  — harmless (unreferenced) but `rm -rf dist` before build for a clean check.
- Consumers import only the barrel (`@function-bucket/fnb-db-types`), never deep paths — swaps/renames
  are mechanical.
- When reasoning about the schema, check the **live DB** (or `db/*/deploy/*.sql`), not
  `src/generated/*` files — kanel doesn't prune, so orphaned generated files can be stale (a phantom
  `app/Location.ts` misled a collision analysis once).
