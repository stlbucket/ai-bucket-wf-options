# Testing Conventions (compiled packages only)

Applies to `packages/` only. Apps (`apps/`) have no testing convention yet.

- Tests live in `src/tests/` — never alongside source files
- File naming: `*.spec.ts` — always `.spec.ts`, never `.test.ts`

## `vitest.config.ts` — required for every package with a `test` script

Vitest does **not** reliably inherit `vite.config.ts` through Turborepo, so every package with a
`test` script needs its own `vitest.config.ts`.

**Package with tests:**
```typescript
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, './src') } },
  test: { include: ['src/tests/**/*.spec.ts'] },
})
```

**Package with no tests yet** (prevents turbo failure):
```typescript
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { passWithNoTests: true } })
```

`pnpm build` is the gate (repo-wide `pnpm lint` is known-broken — memory `project_eslint_broken`).

DB-level tests (pgTAP) are a separate harness — spec `docs/specs/db-testing/`, skill
`pgtap-expert`.
