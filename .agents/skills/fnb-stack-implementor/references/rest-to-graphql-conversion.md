# Converting an Existing Page from REST to GraphQL (legacy)

Use this when a page still runs on Nitro REST + `useFetch` — the companion of `fnb-stack-spec`
Mode 4 (legacy spec cleanup). The DB layer and Vue pages do not change — only the data-fetching
layer. New features start on GraphQL directly (`new-feature-checklist.md`).

## 1. Write (or verify) the GraphQL operation

Add a `.graphql` file in `packages/graphql-client-api/src/graphql/<module>/query/` (or
`mutation/`). Use PostGraphile's auto-generated field names — check
`src/generated/fnb-graphql-api.ts` for exact type/relationship names
(e.g. `modulesByApplicationKeyList`).

```graphql
# src/graphql/app/query/myEntityByKey.graphql
query MyEntityByKey($key: String!) {
  myEntity(key: $key) {
    key
    name
    relatedThings: relatedThingsByEntityKeyList { key name }
  }
}
```

## 2. Run codegen

```bash
pnpm -F @function-bucket/fnb-graphql-client-api generate
```
Regenerates `src/generated/fnb-graphql-api.ts`. Hook name follows the operation:
`query MyEntityByKey` → `useMyEntityByKeyQuery()`.

**Codegen failure signatures:**
- `TS6059: File is not under 'rootDir'` — generated output must stay under `src/`
  (`src/generated/fnb-graphql-api.ts`). Don't relocate codegen output outside `src/`.
- `Unable to find template plugin matching 'typescript-operations'` — the plugin is missing from
  `packages/graphql-client-api/package.json` devDependencies; add it and `pnpm install`.
- `TS2308: already exported` — do **not** re-export both `./generated/fnb-graphql-api` and a
  second file that re-declares the same types from the barrel.

## 3. Write the wrapper composable

Create `packages/graphql-client-api/src/composables/use{Domain}.ts`. Import the generated hook
from `../generated/fnb-graphql-api`. Normalize the response so pages need no template changes:

```typescript
import { computed } from 'vue'
import { useMyEntityByKeyQuery } from '../generated/fnb-graphql-api'

export function useMyEntity(key: string) {
  const { data, fetching, error } = useMyEntityByKeyQuery({ variables: { key } })
  return {
    data: computed(() => {
      const e = data.value?.myEntity
      if (!e) return null
      return { entity: { key: e.key, name: e.name }, relatedThings: e.relatedThings }
    }),
    fetching,
    error,
  }
}
```

**Return shape rules:**
- `data` is always a `computed()` ref — not the raw urql `data` ref
- `fetching` replaces `pending` from `useFetch`
- No `refresh` — use `executeQuery({ requestPolicy: 'network-only' })` from the raw urql hook
- Flatten nested GraphQL relationships when the page expects flat arrays
- Map permission objects to string arrays: `.map(p => p.permissionKey)`

## 4. Export from the package barrel

Add to `packages/graphql-client-api/src/index.ts`: `export * from './composables/use{Domain}'`.
Do **not** re-export a file that re-declares generated types (→ `TS2308`).

## 5. Rebuild the package

```bash
pnpm -F @function-bucket/fnb-graphql-client-api build
```
Clean build with no TS errors before the next steps.

## 6. Update the app composable re-export

```typescript
// apps/<app>/app/composables/use{Domain}.ts
export { useMyEntity } from '@function-bucket/fnb-graphql-client-api'
```
The page file needs **no changes** — it still calls `useMyEntity()` via auto-import, now
GraphQL-backed. Delete any obsolete `server/api/<module>/*` route the page used to hit.

## 7. Verify the urql plugin is configured

`apps/<app>/app/plugins/urql.client.ts` must exist with:
- `preferGetMethod: false` — **required**: PostGraphile rejects GET with 405
- `url: pub.graphqlApiUrl` from `runtimeConfig.public.graphqlApiUrl`
- `provide: { urqlClient: client }` so `useAuth().refreshClaims()` can reach it outside setup
If `@urql/vue` is not in the app `package.json`, add it (`"catalog:"`) — then restart Docker (step 8).

## 8. Docker: install new packages + build graphql-client-api

Docker uses named volumes for `node_modules` — a local `pnpm install` does **not** update the
containers. **Do not rebuild/restart the environment yourself — ask the user** (memory
`feedback_rebuild_ask_user`), then do read-only verification. The restart they run is:
```bash
docker compose down && docker compose up
```
`packages-watch` must build+watch `fnb-graphql-client-api` (it does — see
`package-layers-pattern.md` → Codegen Workflow).

## 9. Verify end-to-end (read-only)

1. Navigate to the page — it should render data
2. Network tab: confirm `POST /graphql-api/api/graphql` with the expected operation name
3. No console errors about a missing urql client or `server.mjs` not found
