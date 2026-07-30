import type { TodoFragment } from '../generated/fnb-graphql-api'
import type { Todo, TodoStatus, TodoType, Urn } from '@function-bucket/fnb-types'
import type { TodoAssigneeView, TodoNode } from '../composables/useTodoDetail'

export const toTodo = (f: TodoFragment): Todo => ({
  id: String(f.id),
  tenantId: String(f.tenantId),
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
type RawTodoAssignee = {
  residentUrn: unknown
  resourceByResidentUrn?: { resident?: { id: unknown; displayName?: string | null } | null } | null
}
type RawTodoNode = TodoFragment & {
  assignees?: RawTodoAssignee[]
  children?: RawTodoNode[]
  hiddenChildren?: { totalCount: number } | null
}

export const toTodoAssigneeView = (raw: RawTodoAssignee): TodoAssigneeView => ({
  residentUrn: String(raw.residentUrn),
  residentId: raw.resourceByResidentUrn?.resident
    ? String(raw.resourceByResidentUrn.resident.id)
    : '',
  displayName: raw.resourceByResidentUrn?.resident?.displayName ?? null,
})

export const toTodoNode = (raw: RawTodoNode): TodoNode => ({
  ...toTodo(raw),
  assignees: (raw.assignees ?? []).map(toTodoAssigneeView),
  children: (raw.children ?? []).map(toTodoNode),
  hiddenChildrenCount: raw.hiddenChildren?.totalCount ?? 0,
})
