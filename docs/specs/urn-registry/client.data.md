# URN Registry — GraphQL Exposure & Client Contract

## Status
Implemented — 2026-07-10; generated names recorded in §1.

---

## 1. PostGraphile exposure

- Add `'res'` and `'res_api'` to `pgServices.schemas` in
  `apps/graphql-api-app/server/graphile.config.ts` (`res_fn` stays internal — never expose).
- Smart tags (`apps/graphql-api-app/postgraphile.tags.json5`) as needed:
  - `res.module_permission`: `@behavior -*` (pure RLS plumbing; no reason to serve it). ✅
  - Hub-relation renames deferred — the generated names below are livable; revisit if a UI
    consumer wants `assets` over `assetsBySubjectUrnList`.
- `res_api.resolve_urn` surfaces as a query field (STABLE); registry reads also come free as
  RLS-filtered selects on `resource`.

### Generated names (recorded 2026-07-10, post-rebuild codegen)

- **Query**: `resolveUrn(_urn)`, `resource(id)`, `resourceByUrn(urn)`, `resources` /
  `resourcesList`, `residents` / `residentsList`, and per-type urn lookups
  (`todoByUrn`, `topicByUrn`, `assetByUrn`, `locationByUrn`, `wfByUrn`,
  `supportTicketByUrn`, `tenantByUrn`, `residentByUrn`).
- **Resource**: scalars + computed `resident` / `tenant` (§4.7); **one-to-one back-references
  to every registered entity** (`topic`, `todo`, `location`, `wf`, `asset`, `supportTicket`)
  — a bonus of the PK-to-PK deferred FK, so the hub navigates both ways without parseUrn;
  reverse reference relations `assetsBySubjectUrn(List)`, `messagesByPostedByResidentUrn(List)`,
  `subscribersByResidentUrn(List)`, `todosByResidentUrn(List)`, `locationsByResidentUrn(List)`,
  `assetsByResidentUrn(List)`; `createdByResident`.
- **Reference forward relations**: `Message.resourceByPostedByResidentUrn`,
  `Subscriber.resourceByResidentUrn`, `Todo.resourceByResidentUrn`,
  `Location.resourceByResidentUrn`, `Asset.resourceByResidentUrn` +
  `Asset.resourceBySubjectUrn`. Sender/owner display names read
  `<relation> { resident { id displayName } }`.
- **`tenant` relations** on the former mirror-FK tables now target `app.tenant`
  (`tenant { id name }` — `tenantId` is not a Tenant field).
- **Mutations**: `assignTodo(input: { _todoId, _residentUrn })` (was `_residentId`);
  `SubscriberInfoInput.residentUrn` (was `msgResidentId`).

## 2. `fnb-types` — the shared vocabulary (R3)

New file `packages/fnb-types/src/urn.ts`, exported from the barrel (`src/index.ts` — the #1
miss):

```ts
export type Urn = string & { readonly __brand: 'Urn' }

export interface ParsedUrn {
  tenantId: string
  module: string
  resourceType: string
  id: string
}

export interface Resource {
  id: string
  tenantId: string
  module: string
  resourceType: string
  urn: Urn
  createdAt: Date
  createdByResidentId: string | null
  archivedAt: Date | null
}
```

Pure helpers (`parseUrn(urn): ParsedUrn | null`, `formatUrn(parts): Urn`, `isUrn(s)`) live
beside the type — they are type-only-adjacent pure functions with zero deps; `fnb-types`
remains dependency-free. Client-side parsing needs no round trip; `resolve_urn` is for
existence/visibility checks and hub entry from a bare URN.

Existing entity types that gain a `urn` field in v1 (generated column ⇒ non-null in GraphQL):
`SupportTicket`, `Topic`, `Todo`, `Location`, `Asset`, `Wf`, **`Tenant`, `Resident`** — add
`urn: Urn` to each in `fnb-types`, expand the corresponding fragments to select it (fragments
select every field — memory `feedback_fragments_all_fields`), and pass it through the mappers.

**Reference fields become URNs** (`_shared.data.md` §6): `MessageWithSender.postedBy*`,
topic subscriber/participant references, todo assignee, asset uploader — typed `Urn` in
`fnb-types`, populated from the renamed `*_resident_urn` columns. Display names resolve
through the `Resource.resident` computed field (§4.7) or directly from `residentsList`
(`app.resident` — the one picker query that replaces `msgResidentsList`/`todoResidentsList`).

## 3. `graphql-client-api`

- Operations (`src/graphql/res/…`):
  - `query/resolveUrn.graphql` — `query ResolveUrn($urn: String!)` → `resolveUrn { … }`
  - `fragment/resourceFields.graphql` — every `Resource` field (R3: full-field fragments)
  - Hub queries stay module-owned (e.g. the todo detail query adds
    `resource { urn assets { … } }` per `stacking.data.md` §4).
- Reworked operations (shadow removal, `_shared.data.md` §6.3): `discussions/fragment/
  Message.graphql` + `Subscriber.graphql`, `msg/query/mySubscribedTopics.graphql`,
  `storage/query/assetDetail.graphql` + `allAssets.graphql`; `todo/query/
  todoResidentsList.graphql` and the msg residents query are replaced by one
  `app/query/residentsList.graphql` (selects `urn`). Composables `useMsgTopics` /
  `useMsgTopic` / `useTodoMsg` / `useMsgResidents` follow.
- Codegen: `pnpm -F @function-bucket/fnb-graphql-client-api generate`; hook
  `useResolveUrnQuery` lands in `src/generated/fnb-graphql-api.ts`.
- Mapper `src/mappers/resource.ts` — `toResource(fragment): Resource` (un-Maybe, `Date`
  coercion, brand the urn).
- Composable `src/composables/useResource.ts`:

  ```ts
  export function useResource(urn: MaybeRefOrGetter<Urn>) {
    // wraps useResolveUrnQuery; returns { resource: computed<Resource | null>, fetching, error }
    // no refresh — executeQuery({ requestPolicy: 'network-only' })
  }
  ```

- **Barrel** `src/index.ts`: `export * from './composables/useResource'` (runtime ESM crash
  if missed, not a build error). Mappers stay internal; the generated module is never
  `export *`'d.

## 4. App re-exports

No v1 pages consume `useResource` yet, so no app re-export ships until the first UI lands
(future attachment-panel spec). When it does:
`apps/<app>/app/composables/useResource.ts` → thin re-export, per R1.

## 5. Verification (read-only, post-deploy)

1. `sqitch status` clean on all packages; fresh `docker compose` DB deploys end-to-end
   (**ask the user** to run any rebuild — memory `feedback_rebuild_ask_user`).
2. GraphiQL: `resolveUrn(urn: "<known todo urn>")` returns the row for an authorized user,
   null for a user of another tenant (Invariant: registry RLS).
3. Hub: `todo { resource { urn assets { id } } }` round-trips; asset uploaded with
   `subjectUrn` appears; user without storage access gets `assets: []`.
4. Adversarial: insert into a registered table via psql **without** registering →
   commit fails on the deferred FK (proves the enforcement).
5. Shadow removal: `\dt msg.*` / `todo.*` / `loc.*` / `storage.*` show no
   `*_tenant`/`*_resident` tables; msg conversation renders sender display names (resource →
   resident hop); the participant picker lists residents; asset detail shows uploader name.
6. Identity registration: `app.tenant` / `app.resident` rows have non-null `urn`; matching
   `res.resource` rows exist (module `app`, types `tenant`/`resident`).
7. `pnpm build` green across the workspace (the repo gate; lint is known-broken).
