# Pre-existing TS error in `packages/db-types/src/utils/parse-modules.ts:40`

**Found:** 2026-07-03, incidentally, while building db-types for asset-storage Phase 2.
**Severity:** Low — non-fatal (build still emits `dist`), but it's real type noise in a
compiled package and masks future regressions.

## Symptom

`pnpm -F @function-bucket/fnb-db-types build` logs (via `vite-plugin-dts`):

```
src/utils/parse-modules.ts:40:5 - error TS2322: Type '{ name: string | null; key: string | null;
  permissionKeys: string[] | null; ... }[] | null' is not assignable to type 'ToolInfoTable[] | null'.
  ...
  Types of property 'key' are incompatible.
    Type 'string | null' is not assignable to type 'ColumnType<string | null, string | null, string | null>'.

40     tools: raw.tools?.map(normalizeTool) ?? null,
```

Not caused by the storage changes — `git diff` for Phase 2 touches only `src/db.ts` and
`src/index.ts`; `parse-modules.ts` is untouched. The error appears intermittently (didn't
reproduce on a second incremental build), consistent with `vite-plugin-dts` incremental caching.

## Root cause

`normalizeTool` returns a plain object shape (`{ key: string | null, ... }`), but the target
type is the **Kysely table interface** `ToolInfoTable`, whose columns are `ColumnType<...>`
wrappers, not plain selectable values. A raw/normalized DTO is being typed against the Kysely
*table* type instead of its `Selectable<ToolInfoTable>` projection.

## Impact

- `vite build` still emits `dist` (exit 0), so runtime is unaffected today.
- But a genuine type error in a compiled shared package means the type-check gate is already
  "dirty" — a new real error here could be missed. (Compounded by ESLint being broken repo-wide;
  `pnpm build` is the only gate — see the ESLint memory.)

## Suggested fix

Type the mapped result against the **selectable** shape, not the table interface. Either:

- Have `normalizeTool` return `Selectable<ToolInfoTable>` (i.e. `ToolInfo`), or
- Define/import the intended DTO type for `tools` and use that as the field type instead of the
  raw `ToolInfoTable[]`.

Confirm against the generated `app_fn` types for the correct `Selectable` alias.
