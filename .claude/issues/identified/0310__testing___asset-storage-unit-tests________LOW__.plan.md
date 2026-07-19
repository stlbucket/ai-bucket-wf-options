# Plan: Unit tests for asset-validation + asset mapper/composable (final-eval M5)

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/asset-storage-unit-tests.plan.md`
> Gate is `pnpm build` then `pnpm test`. Never run `git`; never rebuild Docker yourself — ask the
> user, then verify read-only. Follow the house testing convention exactly: tests in
> `src/tests/*.spec.ts` (never alongside source, never `.test.ts`), per-package `vitest.config.ts`.

**Severity: LOW (quality/enhancement)** · Workstream: asset-storage · Identified: 2026-07-06 (final-eval M5)

## Details

The asset-storage feature shipped with zero tests. Two clusters of pure, cheaply-testable logic:

1. **`packages/storage-layer/server/lib/asset-validation.ts`** — pure functions, no I/O:
   - `toAssetContext` / `toDbContext` (context mapping, `ASSET_CONTEXTS` membership)
   - `extForContentType` (content-type → extension)
   - `assertMagicBytes` + the `ALLOWED_TYPES` accept-set (incl. the documented carve-outs:
     `text/csv`/`text/plain` skip the sniff; OOXML accepts the generic `application/zip` alias)
   - `isUuid`
2. **`packages/graphql-client-api`** — `src/mappers/asset.ts` (`toAsset`: un-Maybe, UUID→string,
   Datetime→`Date`, UPPERCASE enum pass-through, `downloadUrl: string | null`) and the
   `useSiteAssets` view shaping if extractable as a pure function.

## Wrinkles to respect

- The repo testing convention says "compiled packages only"; `storage-layer` is a **Nuxt layer**
  with no `test` script today. Adding one is fine but it enters turbo's `test` task — it MUST get
  its own `vitest.config.ts` (vitest does not inherit vite config through turbo). Use the
  house template with `include: ['src/tests/**/*.spec.ts']` — but note the layer's server files
  live under `server/lib/`, not `src/`; set `include: ['tests/**/*.spec.ts']` with a top-level
  `tests/` dir OR mirror the src convention — decide with the layout that keeps Nuxt from
  scanning test files into the app build (tests must NOT land in `app/` or `server/`).
- `graphql-client-api` already builds via Vite; add `vitest.config.ts` + `src/tests/asset.spec.ts`.
  Import the mapper directly (it is internal/not barrel-exported — import by path, which is fine
  from inside the package's own tests).
- Repo-wide `pnpm lint` is broken (known) — do not try to fix it here; gates are build + test.
- Any package left without tests but gaining a `test` script needs `passWithNoTests: true`.

## Test cases (minimum)

- context round-trips + rejection of unknown contexts
- `extForContentType` for every whitelisted type; unknown type behavior
- magic-byte: valid PNG header passes as `image/png`; HTML bytes declared `image/png` rejected
  (the exact Phase-11 forgery case); `text/plain` bypasses sniffing (EICAR reliance — document in
  a comment); bare `application/zip` rejected by whitelist before sniffing
- `isUuid` accepts v4, rejects junk (the W6 500-path input: `NO_CONTEXT` + junk `owningEntityId`)
- `toAsset`: full fragment maps; nulls (`downloadUrl`, `owningEntityId`, `scanSignature`) survive;
  timestamps become `Date`; enum values pass through UPPERCASE

## Verification

`pnpm test` green from the repo root (turbo); no new files under `storage-layer/app|server` that
Nuxt would try to bundle; `pnpm build` still 12/12.
