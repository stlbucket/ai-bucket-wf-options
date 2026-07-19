import type { TodoFragment } from '../generated/fnb-graphql-api'
import type { Todo, TodoStatus, TodoType, Urn } from '@function-bucket/fnb-types'
import type { TodoNode } from '../composables/useTodoDetail'

export const toTodo = (f: TodoFragment): Todo => ({
  id: String(f.id),
  tenantId: String(f.tenantId),
  residentUrn: f.residentUrn != null ? (String(f.residentUrn) as Urn) : null,
  name: f.name,
  description: f.description ?? null,
  type: f.type as unknown as TodoType,
  status: f.status as unknown as TodoStatus,
  ordinal: f.ordinal,
  pinned: f.pinned,
  tags: (f.tags ?? []).filter((t): t is string => t != null),
  parentTodoId: f.parentTodoId != null ? String(f.parentTodoId) : null,
  rootTodoId: String(f.rootTodoId),
  isTemplate: f.isTemplate,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
  urn: String(f.urn) as Urn,
})

// Raw recursive node as produced by the TodoById query: each nested level is a
// superset of TodoFragment. `children` is present above the deepest level;
// `hiddenChildren.totalCount` only at the deepest level.
type RawTodoNode = TodoFragment & {
  owner?: { resident?: { id: unknown; displayName?: string | null } | null } | null
  children?: RawTodoNode[]
  hiddenChildren?: { totalCount: number } | null
}

export const toTodoNode = (raw: RawTodoNode): TodoNode => ({
  ...toTodo(raw),
  owner: raw.owner?.resident
    ? { residentId: String(raw.owner.resident.id), displayName: raw.owner.resident.displayName ?? null }
    : null,
  children: (raw.children ?? []).map(toTodoNode),
  hiddenChildrenCount: raw.hiddenChildren?.totalCount ?? 0,
})
