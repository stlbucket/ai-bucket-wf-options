# Plan: Map the remaining deep raw trees to typed shapes (#1)

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/fnb-types-map-deep-trees.plan.md`
> Gate is `pnpm build`. Codegen (if needed) requires PostGraphile up at `localhost:4000`.
> Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

## Context

The `fnb-types` rollout left two composables returning **raw generated shapes** internally: the
workflow detail graph (`useWfDetail`) and the todo detail tree (`useTodoDetail`). They work and no
longer leak generated *type names* to the UI (the barrel cutover holds), but their leaf data isn't
mapped to the shared vocabulary. This finishes that: both return typed shapes composed from
`fnb-types` entities + composable **view** types (R4). The recursive trees are query-shaped, so they
stay as composable view types — **not** `fnb-types` entities.

`useSiteAdminUser` → `siteUserById` is **out of scope**: it's an untyped JSON scalar (SQL
`to_jsonb`) with no GraphQL-typed shape to map to; it stays raw (already documented in the composable).

## Steps

### 1. `useWfDetail` (`packages/graphql-client-api/src/composables/useWfDetail.ts`)
Currently returns raw `wf` (`.uowsList` / `.uowDependenciesList` / `.template`). Add a view type and
compose the existing mappers (`toWf`/`toUow`/`toUowDependency` in `src/mappers/workflow.ts`):
```ts
export interface WfDetail extends Wf {
  uows: Uow[]
  dependencies: UowDependency[]
  template: Wf | null
}
```
Return `{ ...toWf(w), uows: (w.uowsList ?? []).filter(nonNull).map(toUow),
dependencies: (w.uowDependenciesList ?? []).filter(nonNull).map(toUowDependency),
template: w.template ? toWf(w.template) : null }`.

- **UI:** `apps/graphql-api-app/app/pages/workflow/[id].vue` — change the `uows`/`deps` computeds to
  read `wf.value?.uows` / `wf.value?.dependencies` (were `uowsList` / `uowDependenciesList`).
  `useWfFlowGraph` already annotates `Uow[]`/`UowDependency[]`/`Wf` — now the data actually matches.

### 2. `useTodoDetail` (`…/useTodoDetail.ts`) + `src/mappers/todo.ts`
`todoTree` is a recursive **view** (owner + children + deepest-level `hiddenChildren.totalCount`).
`TodoDetail.vue` currently redefines it locally. Define once in the composable (R4):
```ts
export interface TodoOwner { residentId: string; displayName: string | null }
export interface TodoNode extends Todo {
  owner: TodoOwner | null
  children: TodoNode[]
  hiddenChildrenCount: number   // deepest level's hiddenChildren.totalCount; 0 above
}
```
Add recursive `toTodoNode(raw): TodoNode` to `mappers/todo.ts` (spread `toTodo` for scalars, map
`owner`, recurse `children`, `hiddenChildren?.totalCount ?? 0`). Return `todoTree: raw ? toTodoNode(raw) : null`.

- **UI:** `apps/tenant-app/app/components/todo/{TodoDetail,TodoDetailSubtasks}.vue` — import
  `TodoNode`/`TodoOwner` from `~/composables/useTodoDetail`, delete the local duplicate types, and
  change the deepest reference `hiddenChildren.totalCount` → `hiddenChildrenCount`.

## Critical files
- `packages/graphql-client-api/src/composables/{useWfDetail,useTodoDetail}.ts` (+ view types)
- `packages/graphql-client-api/src/mappers/todo.ts` (add `toTodoNode`)
- `apps/graphql-api-app/app/pages/workflow/[id].vue`
- `apps/tenant-app/app/components/todo/{TodoDetail,TodoDetailSubtasks}.vue`

## Verification
- `pnpm -F @function-bucket/fnb-graphql-client-api build` then `pnpm build` — zero TS errors (the
  package DTS build typechecks the recursive mapper + view types).
- Grep: `useWfDetail`/`useTodoDetail` no longer return raw `data.value?.x` passthrough.
- Runtime (after the user rebuilds Docker): workflow detail graph renders + polls; todo detail tree
  renders owners / subtasks / hidden-children counts. No ESM barrel-miss crash.

## Notes
- These composites are composable **view types (R4)** — do not put them in `fnb-types` (flat shared
  entities only). `siteUserById` stays raw JSON (out of scope).
