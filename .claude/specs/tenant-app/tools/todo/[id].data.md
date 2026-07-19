# tools/todo/[id] — Todo Detail Data


> **URN stacking v2 (2026-07-10):** `msg.topic.context` is **removed**; topics carry
> `subject_urn text REFERENCES res.resource(urn)` (partial-unique — one discussion per subject).
> `createTopic` has no `domain` param; `TopicInfoInput` has `subjectUrn`, no `context`. The todo
> discussion no longer shares the todo's id — `useTodoMsg(todoUrn)` queries `DiscussionBySubject`
> and topics have their own ids/registry rows. Authoritative contract:
> `.claude/specs/urn-registry/stacking-v2.data.md`. `context`/id-sharing mentions below are historical.

## Status
Implemented — GraphQL. The **Attachments** section (spec'd + implemented 2026-07-09, issue 0480)
is live: issue 0330 delivered `useEntityAssets` + the tenant-app ⟶ storage-layer wiring, and the
todo detail page now consumes them.

## Route
`/tenant/tools/todo/[id]` — see `[id].ui.md` for UI details

## GraphQL

### Query on load
- **Query name**: `TodoById`
- **File**: `packages/graphql-client-api/src/graphql/todo/query/todoById.graphql`
- **Generated hook**: `useTodoByIdQuery()` in `src/generated/fnb-graphql-api.ts`
- **Variables**: `id: UUID!` (from `route.params.id`)
- **Returns**: full `TodoTree` — todo with location, owner (resident), and `children` nested 4 levels deep; each child has location + owner + their own children
- **404 behavior**: if `data.todo` is null, redirect to `/tenant/tools/todo`

### Lightweight refresh query
- **Query name**: `TodoByIdForRefresh`
- **File**: `packages/graphql-client-api/src/graphql/todo/query/todoByIdForRefresh.graphql`
- **Generated hook**: `useTodoByIdForRefreshQuery()`
- **Use case**: after `updateTodoStatus` to update status rollup across 12 parent levels without re-fetching the full tree

### Mutations

| Mutation | Hook | Variables | After success |
|---|---|---|---|
| `UpdateTodo` | `useUpdateTodoMutation()` | `todoId`, `name`, `description` | Reload full `TodoById` |
| `UpdateTodoStatus` | `useUpdateTodoStatusMutation()` | `todoId`, `status: TodoStatus!` | Run `TodoByIdForRefresh` to sync parent statuses; **no full reload** |
| `DeleteTodo` | `useDeleteTodoMutation()` | `todoId` | `navigateTo('/tenant/tools/todo')` |
| `CreateTodo` | `useCreateTodoMutation()` | `name`, `description`, `parentTodoId` | Reload full `TodoById` on parent |
| `MakeTemplateFromTodo` | `useMakeTemplateFromTodoMutation()` | `todoId` | `navigateTo('/tenant/tools/todo/{newId}')` |
| `MakeTodoFromTemplate` | `useMakeTodoFromTemplateMutation()` | `todoId` | `navigateTo('/tenant/tools/todo/{newId}')` |
| `AssignTodo` | `useAssignTodoMutation()` | `todoId`, `residentId` | Reload full `TodoById` |
| `PinTodo` | `usePinTodoMutation()` ⚠️ | `todoId` | Reload full `TodoById` |
| `UnpinTodo` | `useUnpinTodoMutation()` ⚠️ | `todoId` | Reload full `TodoById` |

⚠️ **PinTodo / UnpinTodo**: PostGraphile types exist (`PinTodoInput`, `PinTodoPayload`) but no `.graphql` mutation files exist yet. Before implementing pin, create:
- `packages/graphql-client-api/src/graphql/todo/mutation/pinTodo.graphql`
- `packages/graphql-client-api/src/graphql/todo/mutation/unpinTodo.graphql`
Then re-run codegen to get `usePinTodoMutation()` and `useUnpinTodoMutation()`.

### Location mutations
Owned by `useTodoDetail` — the detail composable calls these directly rather than delegating to the `loc` composable.

- `CreateLocation` → `useCreateLocationMutation()` (from `packages/graphql-client-api/src/graphql/locations/`)
- `UpdateLocation` → `useUpdateLocationMutation()` (from same)

After either location mutation, reload the full `TodoById` query.

## Composable

Separate from `useTodoList`. Two composables, two files.

- **Source (to create)**: `packages/graphql-client-api/src/composables/useTodoDetail.ts`
- **Re-export (to create)**: `apps/tenant-app/app/composables/useTodoDetail.ts`

```ts
const {
  todoTree,
  fetching,
  error,
  updateTodo,
  updateStatus,
  deleteTodo,
  addSubtask,
  makeTemplate,
  cloneTemplate,
  assignResident,
  pinTodo,
  unpinTodo,
  addLocation,
  updateLocation,
} = useTodoDetail(todoId)
```

| Export | Shape | Behavior |
|---|---|---|
| `todoTree` | `Ref<TodoTree \| null>` | from `TodoById` query |
| `fetching` | `Ref<boolean>` | loading state |
| `updateTodo(name, description)` | `Promise<void>` | `UpdateTodo` mutation → full `TodoById` reload |
| `updateStatus(todoId, status)` | `Promise<void>` | `UpdateTodoStatus` → `TodoByIdForRefresh`; patches statuses in `todoTree` without full reload |
| `deleteTodo()` | `Promise<void>` | `DeleteTodo(currentId)` → `navigateTo('/tenant/tools/todo')` |
| `addSubtask(name, parentId)` | `Promise<void>` | `CreateTodo({ parentTodoId })` → full `TodoById` reload |
| `makeTemplate()` | `Promise<void>` | `MakeTemplateFromTodo(currentId)` → `navigateTo('/tenant/tools/todo/{newId}')` |
| `cloneTemplate()` | `Promise<void>` | `MakeTodoFromTemplate(currentId)` → `navigateTo('/tenant/tools/todo/{newId}')` |
| `assignResident(residentId)` | `Promise<void>` | `AssignTodo(currentId, residentId)` → full `TodoById` reload |
| `pinTodo()` | `Promise<void>` | `PinTodo(currentId)` → full `TodoById` reload |
| `unpinTodo()` | `Promise<void>` | `UnpinTodo(currentId)` → full `TodoById` reload |
| `addLocation(info)` | `Promise<void>` | `CreateLocation(info)` → full `TodoById` reload |
| `updateLocation(info)` | `Promise<void>` | `UpdateLocation(info)` → full `TodoById` reload |

**Delete confirmation**: `TodoDetail` component shows a `UModal` with "Are you sure?" before emitting `@delete`. The component owns the confirmation UI; `useTodoDetail.deleteTodo()` does not confirm — it just executes.

## Attachments
*Spec'd 2026-07-09 (issue `0480__storage___todo-detail-asset-attachments`). The asset stack
(endpoint, scan workflow, GraphQL ops, types) is owned by `.claude/specs/asset-storage/` — this
section only specs the todo consumption. UI: `[id].ui.md` → Attachments.*

**Prerequisites** (issue `0330__storage___asset-entity-composable` + issue 0480 Phase 3):
- `useEntityAssets(context, owningEntityId)` composable exists in `graphql-client-api`
  (wraps `AssetsByOwningEntity` with `assetStatus: ACTIVE` + `parentAssetId: null`, maps `toAsset`)
- tenant-app extends `@function-bucket/fnb-storage-layer` (declared in its `package.json`, R24)
  so `AssetUploader`, `useAssetUpload`, `useAssetDelete`, and the `/assets/[id]` detail page
  resolve; tenant-app's compose service gets `NUXT_PUBLIC_UPLOAD_URL` (same value as storage-app)

### List
- **Query**: `AssetsByOwningEntity($context: TODO, $owningEntityId: <todoId>)` — already in
  `packages/graphql-client-api/src/graphql/storage/query/assetsByOwningEntity.graphql`
- **Composable**: `useEntityAssets('TODO', todoId)` — source
  `packages/graphql-client-api/src/composables/useEntityAssets.ts`, thin re-export
  `apps/tenant-app/app/composables/useEntityAssets.ts`
- Returns `{ assets: ComputedRef<Asset[]>, fetching, error }` + network-only re-query for refresh
  (fnb-types `Asset`; RLS scopes to the caller's tenant)
- Assets are **not** part of the todo tree — list refresh never triggers a `TodoById` reload,
  and todo mutations never touch the asset list

### Upload (REST carve-out — R2/R5 documented exception)
- `AssetUploader` (storage-layer) owns the multipart POST via `useAssetUpload` →
  `NUXT_PUBLIC_UPLOAD_URL` (`/storage/api/upload`, same-origin, session cookie rides along)
- Responds **202** with a `PENDING` `AssetMeta`; success toast is the uploader's
  ("Upload accepted — scanning…", UC7)
- Page handles `@uploaded`: refresh `useEntityAssets` (network-only). The scan verdict lands
  later; a subsequent refresh reveals `CLEAN` + `downloadUrl`

### Delete (REST carve-out, same posture)
- Page handles `@delete-asset`: `useAssetDelete().remove(assetId)` (storage-layer) —
  `DELETE {uploadUrl-sibling}/assets/{id}`, soft-delete + MinIO purge, DB enforces permission
  (403 surfaces via the composable's `error` → toast, UC7)
- On success: refresh `useEntityAssets`; the `assetStatus: ACTIVE` filter hides the row

### Page wiring
`[id].vue` adds `useEntityAssets('TODO', todoId)` alongside `useTodoDetail(todoId)` and passes
`assets` into `TodoDetail` / `TodoDetailSmall`; upload/delete emits bubble to the page (R1/R2 —
components stay props-only; `AssetUploader` is the documented exception).

## Types

`TodoTree` is the TypeScript type derived from `TodoByIdQuery['todo']` — use the generated type directly.

```ts
type TodoTree = NonNullable<TodoByIdQuery['todo']>
type TodoTreeChild = TodoTree['children'][number]
```

Do not define a separate `TodoTree` interface — use the generated query result type.

See `_shared.data.md` → Todo, TodoStatus, TodoType, TodoResident for the base types.

## Decisions
- **Composable split**: `useTodoList` for index, `useTodoDetail` for detail — two files, no shared composable
- **Status refresh**: `TodoByIdForRefresh` after `updateTodoStatus`; full `TodoById` reload after all other mutations
- **Delete confirmation**: UModal in the `TodoDetail` component; composable just executes
- **Location mutations**: owned by `useTodoDetail`, not the `loc` composable
- **Attachments** (2026-07-09): separate `useEntityAssets` composable, never folded into
  `useTodoDetail`; list refresh is asset-only (no `TodoById` reload); uploads private-only;
  delete in v1 with confirm; storage REST carve-outs (`useAssetUpload`/`useAssetDelete`) are the
  only non-GraphQL data paths on this page
