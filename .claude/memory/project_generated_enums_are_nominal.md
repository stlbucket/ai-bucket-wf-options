---
name: project_generated_enums_are_nominal
description: graphql-codegen emits nominal TS enums; fnb-types string-union enum values need `as unknown as` to flow into generated mutation variables
metadata:
  type: project
---

`packages/graphql-client-api/codegen.ts` has **no `enumsAsTypes`** config, so graphql-codegen
emits generated GraphQL enums (e.g. `TenantType`) as nominal TS `enum`s. `fnb-types` enums are
string-literal unions (`'ANCHOR' | ...`, R3). TS enums are **nominal**: a `fnb-types` union value
is NOT assignable to a generated `enum` even when the values match verbatim.

- **Reads** (generated → fnb-types) already bridge with `as unknown as` in the mappers
  (`src/mappers/tenant.ts`: `f.type as unknown as TenantType`).
- **Writes** (fnb-types → a generated **mutation variable**) hit the same wall. Keep the public
  composable signature on the `fnb-types` union, then cast at the exec call site the same way —
  `execSetType({ type: type as unknown as GqlTenantType })` (see `useWorkspaces.ts` `setNestedType`).

**Why:** regenerating the GraphQL API (`pnpm graphql-api-generate`) can surface this as a fresh
`TS2322` dts-build failure in `packages-watch` on any composable that pushes a `fnb-types` enum into
a mutation — it blocks all apps from starting. It's latent, not caused by whatever else changed.

**How to apply:** when a codegen regen breaks the `graphql-client-api` build with
"Type '\"X\"' is not assignable to type '<Enum>'", add a `import type { <Enum> as Gql<Enum> }`
from `../generated/fnb-graphql-api` and cast the value `as unknown as Gql<Enum>` at the mutation
call. Do not widen the `fnb-types` enum or flip codegen to `enumsAsTypes` unilaterally — the
nominal-enum + boundary-cast pattern is the established house convention. See [[project_spec_system]].
