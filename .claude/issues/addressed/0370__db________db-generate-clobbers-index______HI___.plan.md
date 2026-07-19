# `scripts/db-generate.ts` step 4 clobbers the hand-maintained `src/index.ts`

**Found:** 2026-07-03, during asset-storage Phase 2 (db-types generation).
**Severity:** High — running the standard command silently deletes working barrel exports,
causing an ESM startup crash (not a build error).

## Symptom

`scripts/db-generate.ts` step 4 ("Rebuild src/index.ts") **overwrites**
`packages/db-types/src/index.ts` with a hardcoded list:

```ts
const indexLines = [
  '// Generated types',
  "export * from '@/generated/fnb-app/app/index'",
  "export * from '@/generated/fnb-app/app_fn/index'",
  "export * from '@/generated/fnb-auth/auth/index'",
  '', '// DB', ...,
  '', '// Queries', ...queryFiles,
  '', '// Mutations',
  "export * as appFn from '@/mutations/fnb-app/app_fn/index'",
  "export * as appApi from '@/mutations/fnb-app/app_api/index'",
]
writeFileSync(join(SRC, 'index.ts'), indexLines.join('\n') + '\n')
```

This hardcoded list is **stale**. It omits everything the current, working `src/index.ts` has:

- `export * from '@/generated/fnb-msg/msg/index'` (and now `fnb-storage`)
- `export * from '@/queries/resident'` is preserved (readdir), but…
- `export * from '@/with-claims'` — **dropped**
- `export * as authFn from '@/mutations/fnb-auth/index'` — **dropped**
- `export * as msgApi from '@/mutations/fnb-msg/index'` — **dropped**

## Why it's dangerous

Missing barrel exports do **not** surface as TypeScript or build errors — they crash the Node
ESM loader at app startup with `does not provide an export named 'X'` pointing at compiled
`dist/index.js` (documented as the "#1 miss" in CLAUDE.md). So a maintainer who runs
`pnpm db-generate` to regenerate types would get a clean build and only discover the breakage
when an app fails to boot.

The barrel is meant to be **hand-maintained** (CLAUDE.md is explicit about this), which directly
conflicts with step 4 rewriting it from a hardcoded list.

## Evidence

The live `src/index.ts` diverges from what step 4 would produce (it has `msg`, `withClaims`,
`authFn`, `msgApi`), which means the standard wrapper is **not** actually being run to completion
by maintainers today — types are regenerated some other way and the barrel is fixed by hand.

## Workaround used for Phase 2

Did not run the wrapper. Ran kanel directly (writes only to `src/generated/`), then hand-edited
`src/index.ts` to add the storage export — per the spec's manual barrel-wiring step.

## Suggested fixes (pick one)

1. **Delete step 4 entirely** — treat `src/index.ts` as hand-maintained (matches CLAUDE.md).
2. **Derive the barrel fully from disk** — instead of a hardcoded prefix, enumerate all
   `generated/*/*/index`, all `queries/*`, all `mutations/*` namespaces, and always include
   `with-claims`. Make it complete and data-driven so it can't drift.
3. At minimum, add the missing lines (`with-claims`, `authFn`, `msgApi`, `msg`/`storage`
   generated) so the hardcoded list stops dropping working exports.

Note: step 2 (barrel rebuild) has the same staleness — its `generatedDirs` list only covers
`fnb-app/app`, `fnb-app/app_fn`, `fnb-auth/auth`, so per-schema barrels for msg/storage/etc. are
not rebuilt by the wrapper either.

## Related

- [db-generate-crashes-on-fnb-loc.md](./db-generate-crashes-on-fnb-loc.md)
