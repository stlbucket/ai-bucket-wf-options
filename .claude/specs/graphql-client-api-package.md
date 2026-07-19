## Status
Implemented — reverse-engineered from the initial package scaffold.

---

## Purpose

`packages/graphql-client-api` is a compiled ESM TypeScript library that introspects the
PostGraphile 5 GraphQL API and generates a typed `fnb-graphql-api.ts` file containing all
schema types. Consuming apps import from `@function-bucket/fnb-graphql-client-api`.

---

## Package Details

- **Package name**: `@function-bucket/fnb-graphql-client-api`
- **Location**: `packages/graphql-client-api/`
- **Pattern**: Compiled library (same as `auth-server`, `db-access`) — builds to `dist/` via Vite

> Canonical stack context: `.claude/specs/graphql-api-pattern.md` (Layer 3) and
> `.claude/specs/package-layers-pattern.md` (package inventory). This file details codegen only.

---

## File Inventory

```
packages/graphql-client-api/
├── package.json          ← scripts: generate, build, dev, test, lint; dep on fnb-db-access
├── tsconfig.json         ← extends ../../tsconfig.json
├── vite.config.ts        ← ESM build (vite-plugin-dts), externals: graphql, entry: src/index.ts
├── codegen.ts            ← graphql-codegen config (schema URL, documents, output, plugins)
└── src/
    ├── index.ts          ← export * from './generated/fnb-graphql-api' + one line per composable
    ├── graphql/<module>/{query,mutation,fragment}/*.graphql   ← hand-written operation documents
    ├── composables/use{Domain}.ts   ← wrap generated hooks, shape responses (view types live here)
    └── generated/
        ├── fnb-graphql-api.ts   ← GENERATED typed urql/vue hooks — do not edit
        ├── schema.json          ← GENERATED introspection
        └── schema.min.json      ← GENERATED urql-introspection
```

---

## Codegen Configuration (`codegen.ts`)

- **Schema source**: `http://localhost:4000/graphql-api/api/graphql`
- **Documents**: `src/graphql/**/*.graphql`
- **Output**: `src/generated/fnb-graphql-api.ts` (+ `schema.json` introspection, `schema.min.json` urql-introspection)
- **Plugins used**:
  - `typescript` — base TS types for all GraphQL types, inputs, scalars, enums
  - `typescript-operations` — typed results/variables for each operation document
  - `typescript-vue-urql` — generates `use<Op>Query()` / `use<Op>Mutation()` Vue composables
- **Config**: `gqlImport: '@urql/vue#gql'`, `arrayInputCoercion: false`, `nonOptionalTypename: true`

---

## Running Codegen

```
pnpm -F @function-bucket/fnb-graphql-client-api generate
```

The package `generate` script runs `graphql-codegen --config codegen.ts`, then rebuild with
`pnpm -F @function-bucket/fnb-graphql-client-api build`.

**Prerequisite**: PostGraphile must be running at `http://localhost:4000/graphql-api/api/graphql`
before running codegen.

---

## Dependencies

All codegen deps are `devDependencies` (only needed at codegen-time and build-time):

| Package | Purpose |
|---|---|
| `@graphql-codegen/cli` | CLI runner for codegen |
| `@graphql-codegen/typescript` | Base TS types from schema |
| `@graphql-codegen/typescript-operations` | Typed results/variables per operation document |
| `@graphql-codegen/typescript-vue-urql` | `use<Op>Query()` / `use<Op>Mutation()` Vue composables |
| `@graphql-codegen/introspection` | `schema.json` introspection |
| `@graphql-codegen/urql-introspection` | `schema.min.json` urql normalized-cache introspection |
| `graphql` | Required peer dep for all codegen packages |

Runtime deps: `@function-bucket/fnb-db-access` (for the `ProfileClaims` type); peers `@urql/vue`, `vue`.
The built `dist/` externalizes `graphql` — consuming apps must have `graphql` installed.

---

## Consuming in Apps

Add as a workspace dependency:
```json
"@function-bucket/fnb-graphql-client-api": "workspace:*"
```

Import types:
```ts
import type { MyType, MyInput } from '@function-bucket/fnb-graphql-client-api'
```

---

## gitignore

`packages/graphql-client-api/src/generated` is gitignored. Run
`pnpm -F @function-bucket/fnb-graphql-client-api generate` to regenerate after schema changes.
