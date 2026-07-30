# Mode 4 (legacy cleanup): reconcile a stale REST-era `.data.md` to GraphQL

GraphQL is the **default** stack (Modes 1–3 already assume it). This mode is only for cleaning up
an older `.data.md` still written against Nitro REST routes + `useFetch` — the migration already
happened in code. **Rule: `*.ui.md` files are never touched.** Only the data contract changes.
(Code-side companion: the implementor's `references/rest-to-graphql-conversion.md`.)

## Workflow

1. Create or update `_shared.data.md` — document the **GraphQL Client Setup**:
   - urql plugin (`apps/<app>/app/plugins/urql.client.ts`): `preferGetMethod: false`, exchanges,
     `url` from `runtimeConfig.public.graphqlApiUrl`
   - `packages/graphql-client-api` as the composable source; the app re-export file location
   - Entity/view types come from `@function-bucket/fnb-types` (the shared vocabulary) — replace
     any Kysely/db-types-derived or generated-type docs. Generated codegen types are internal to
     `graphql-client-api` (consumed only by mappers `src/mappers/<entity>.ts`). See R3.

2. For each page's `.data.md`:
   - Remove any `## API` section (REST route path, HTTP method, handler file, Kysely queries)
   - Add a `## GraphQL` section: operation name; `.graphql` file path in
     `packages/graphql-client-api/src/graphql/<module>/{query,mutation}/`; generated hook name
     (`use<Op>Query`/`use<Op>Mutation`); variables; what it fetches
   - Update the `## Composable` section:
     - Source is `packages/graphql-client-api/src/composables/`; add the app re-export location
     - Return shape: `pending` → `fetching`, no `refresh` (use
       `executeQuery({ requestPolicy: 'network-only' })`)
     - Document any response transformation (flattening nested lists, mapping permission objects)
   - Change status line to `Implemented — GraphQL`

3. Verify no `useFetch`, `$fetch`, or `/api/` references remain (except a genuine `withClaims`
   carve-out — the msg WS incremental read or the storage multipart upload).
