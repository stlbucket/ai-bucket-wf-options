# `pnpm db-generate` crashes on `fnb-loc` (blocks loc/wf/storage type generation)

**Found:** 2026-07-03, during asset-storage Phase 2 (db-types generation).
**Severity:** High — the canonical type-generation command is unusable end-to-end.

## Symptom

Running the project-standard command:

```bash
pnpm db-generate        # → scripts/db-generate.ts → pnpm generate → tsx kanel.config.ts
```

crashes with:

```
TypeError: Cannot read properties of undefined (reading 'compositeTypes')
    at .../kanel/build/generators/resolveType.js:154:45
```

preceded by many `Could not resolve reference { schemaName: 'app', tableName: 'tenant', ... }`
warnings originating from the `fnb-loc` package.

## Root cause

`packages/db-types/kanel.config.ts` iterates `dbPackages` (from `db/db-config.ts`) and calls
`processDatabase` once per package with **only that package's own schemas**:

```ts
{ name: 'fnb-loc', ..., schemas: ['loc', 'loc_fn', 'loc_api'] }
```

`loc_fn` / `loc_api` contain **composite types / function signatures that reference types in
other schemas** (e.g. `app.*`). When kanel resolves a composite property whose type lives in a
schema not included in the current `processDatabase` call, `schemas[schemaName]` is `undefined`
and `resolveType.js` throws on `.compositeTypes`.

The cross-schema FK `Could not resolve reference` lines are only warnings (msg/storage hit them
too and still generate). The **composite-type** reference is fatal.

## Impact

`fnb-loc` is 4th of 7 in the package list (`auth, app, msg, loc, todo, wf, storage`). The crash
aborts the single Node process, so **nothing after `fnb-loc` is generated** — confirmed by
`src/generated/` containing `fnb-app`, `fnb-auth`, `fnb-msg`, `fnb-todo` but **not** `fnb-loc`,
`fnb-wf`, or `fnb-storage`.

## Workaround used for Phase 2

Generated the `storage` schema in isolation with a one-off script mirroring `kanel.config.ts`'s
options but with `schemas: ['storage']` and `outputPath: './src/generated/fnb-storage'`. The
`storage` schema has no composite types, so it generates cleanly (exit 0). Script was deleted
after use.

## Suggested fixes (pick one)

1. **Include referenced schemas in each `processDatabase` call** — pass the full set of schemas
   the package's composites can reference (e.g. add `app`, `jwt`, `public`) even if only the
   package's own schemas are emitted. Kanel needs them loaded to resolve types.
2. **Only generate table/enum-bearing schemas** — drop `*_fn` / `*_api` from the `schemas` lists
   in `db-config.ts` for generation purposes if function/composite types aren't needed as Kysely
   types (storage already does this: `schemas: ['storage']` only).
3. **Isolate failures per package** — wrap each `processDatabase` in try/catch so one package's
   crash doesn't abort generation of the rest.

## Related

- [db-generate-clobbers-hand-maintained-index.md](./db-generate-clobbers-hand-maintained-index.md)
