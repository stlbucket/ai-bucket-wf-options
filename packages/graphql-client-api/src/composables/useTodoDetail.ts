import { computed } from 'vue'
import type { Todo } from '@function-bucket/fnb-types'
import { toTodoNode } from '../mappers/todo'
import {
  useTodoByIdQuery,
  useUpdateTodoMutation,
  useUpdateTodoStatusMutation,
  useDeleteTodoMutation,
  useCreateTodoMutation,
  useMakeTemplateFromTodoMutation,
  useMakeTodoFromTemplateMutation,
  useAddTodoAssigneeMutation,
  useRemoveTodoAssigneeMutation,
  usePinTodoMutation,
  useUnpinTodoMutation,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useResidentPickerQuery,
  type TodoStatus,
  type LocationInfoInput,
} from '../generated/fnb-graphql-api'

export interface TodoAssigneeView {
  residentUrn: string
  residentId: string
  displayName: string | null
}

// Recursive, query-shaped view of a todo subtree (assignees + children +
// deepest-level hidden-children count). A composable view type (R4), not a
// flat fnb-types entity.
export interface TodoNode extends Todo {
  assignees: TodoAssigneeView[]
  children: TodoNode[]
  hiddenChildrenCount: number
}

export function useTodoDetail(todoId: string) {
  const { data, fetching, error, executeQuery } = useTodoByIdQuery({ variables: { id: todoId } })
  const { data: residentsData } = useResidentPickerQuery()

  const { executeMutation: execUpdateTodo } = useUpdateTodoMutation()
  const { executeMutation: execUpdateStatus } = useUpdateTodoStatusMutation()
  const { executeMutation: execDelete } = useDeleteTodoMutation()
  const { executeMutation: execCreateTodo } = useCreateTodoMutation()
  const { executeMutation: execMakeTemplate } = useMakeTemplateFromTodoMutation()
  const { executeMutation: execCloneTemplate } = useMakeTodoFromTemplateMutation()
  const { executeMutation: execAddAssignee } = useAddTodoAssigneeMutation()
  const { executeMutation: execRemoveAssignee } = useRemoveTodoAssigneeMutation()
  const { executeMutation: execPin } = usePinTodoMutation()
  const { executeMutation: execUnpin } = useUnpinTodoMutation()
  const { executeMutation: execCreateLocation } = useCreateLocationMutation()
  const { executeMutation: execUpdateLocation } = useUpdateLocationMutation()

  const todoTree = computed<TodoNode | null>(() => {
    const raw = data.value?.todo
    return raw ? toTodoNode(raw) : null
  })

  const parentChain = computed(() => {
    const chain: Array<{ id: string; name: string }> = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = data.value?.todo?.parentTodo
    while (node) {
      chain.unshift({ id: String(node.id), name: node.name as string })
      node = node.parentTodo ?? null
    }
    return chain
  })

  // Assignable residents: active, inactive, or invited residents of the todo's EXACT tenant.
  // RLS on app.resident spans the workspace tree, so the rows must be pinned to the
  // todo's own tenant_id here — never the top-level tenant or a sibling workspace.
  const residents = computed(() => {
    const todoTenantId = data.value?.todo?.tenantId
    if (todoTenantId == null) return []
    return (residentsData.value?.residentsList ?? [])
      .filter((r): r is NonNullable<typeof r> => r != null)
      .filter((r) => String(r.tenantId) === String(todoTenantId))
      .filter((r) => r.status === 'ACTIVE' || r.status === 'INACTIVE' || r.status === 'INVITED')
      .map((r) => ({ residentId: r.id, urn: String(r.urn), displayName: r.displayName ?? '', tenantId: r.tenantId }))
  })

  function reload() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  async function updateTodo(name: string, description: string | null): Promise<void> {
    const result = await execUpdateTodo({ todoId, name, description })
    if (result.error) throw result.error
    reload()
  }

  async function updateStatus(targetTodoId: string, status: TodoStatus): Promise<void> {
    const result = await execUpdateStatus({ todoId: targetTodoId, status })
    if (result.error) throw result.error
    reload()
  }

  async function deleteTodo(): Promise<void> {
    const result = await execDelete({ todoId })
    if (result.error) throw result.error
  }

  async function addSubtask(name: string, parentId: string): Promise<void> {
    const result = await execCreateTodo({ name, parentTodoId: parentId })
    if (result.error) throw result.error
    reload()
  }

  async function makeTemplate(): Promise<string | null> {
    const result = await execMakeTemplate({ todoId })
    if (result.error) throw result.error
    return result.data?.makeTemplateFromTodo?.todo?.id
      ? String(result.data.makeTemplateFromTodo.todo.id)
      : null
  }

  async function cloneTemplate(): Promise<string | null> {
    const result = await execCloneTemplate({ todoId })
    if (result.error) throw result.error
    return result.data?.makeTodoFromTemplate?.todo?.id
      ? String(result.data.makeTodoFromTemplate.todo.id)
      : null
  }

  async function addAssignee(residentUrn: string): Promise<void> {
    const result = await execAddAssignee({ todoId, residentUrn })
    if (result.error) throw result.error
    reload()
  }

  async function removeAssignee(residentUrn: string): Promise<void> {
    const result = await execRemoveAssignee({ todoId, residentUrn })
    if (result.error) throw result.error
    reload()
  }

  async function pinTodo(): Promise<void> {
    const result = await execPin({ todoId })
    if (result.error) throw result.error
    reload()
  }

  async function unpinTodo(): Promise<void> {
    const result = await execUnpin({ todoId })
    if (result.error) throw result.error
    reload()
  }

  async function addLocation(locationInfo: Omit<LocationInfoInput, 'id'>): Promise<void> {
    const result = await execCreateLocation({ locationInfo })
    if (result.error) throw result.error
    reload()
  }

  async function updateLocation(locationInfo: LocationInfoInput): Promise<void> {
    const result = await execUpdateLocation({ locationInfo })
    if (result.error) throw result.error
    reload()
  }

  return {
    todoTree,
    parentChain,
    residents,
    fetching,
    error,
    updateTodo,
    updateStatus,
    deleteTodo,
    addSubtask,
    makeTemplate,
    cloneTemplate,
    addAssignee,
    removeAssignee,
    pinTodo,
    unpinTodo,
    addLocation,
    updateLocation,
  }
}
