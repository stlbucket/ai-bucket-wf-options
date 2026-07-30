import { computed, ref } from 'vue'
import type { Todo } from '@function-bucket/fnb-types'
import {
  useSearchTodosQuery,
  useCreateTodoMutation,
  usePinTodoMutation,
  useUnpinTodoMutation,
  type SearchTodosQueryVariables,
} from '../generated/fnb-graphql-api'
import { toTodo, toTodoAssigneeView } from '../mappers/todo'
import type { TodoAssigneeView } from './useTodoDetail'

// List row view (R4): flat Todo + its assignees for the list avatar cell.
export interface TodoListItem extends Todo {
  assignees: TodoAssigneeView[]
}

export function useTodoList() {
  const variables = ref<SearchTodosQueryVariables>({
    rootsOnly: true,
    isTemplate: false,
  })

  const { data, fetching, error, executeQuery } = useSearchTodosQuery({ variables })
  const { executeMutation: execCreate } = useCreateTodoMutation()
  const { executeMutation: execPin } = usePinTodoMutation()
  const { executeMutation: execUnpin } = useUnpinTodoMutation()

  const todos = computed<TodoListItem[]>(() => {
    const nodes = (data.value?.searchTodos?.nodes ?? [])
      .filter((t): t is NonNullable<typeof t> => t != null)
      .map((t) => ({ ...toTodo(t), assignees: (t.assignees ?? []).map(toTodoAssigneeView) }))
    return [...nodes].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })
  })

  function search(searchTerm: string, isTemplate: boolean) {
    variables.value = {
      ...variables.value,
      rootsOnly: true,
      isTemplate,
      searchTerm: searchTerm || undefined,
    }
  }

  function filterAssignedTo(residentUrn: string | null) {
    variables.value = {
      ...variables.value,
      assignedToResidentUrn: residentUrn ?? undefined,
    }
  }

  async function createTodo(name: string, description?: string): Promise<{ id: string }> {
    const result = await execCreate({ name, description })
    if (result.error) throw result.error
    const id = result.data?.createTodo?.todo?.id
    if (!id) throw new Error('No todo id returned')
    return { id: String(id) }
  }

  async function pinTodo(todoId: string): Promise<void> {
    const result = await execPin({ todoId })
    if (result.error) throw result.error
    executeQuery({ requestPolicy: 'network-only' })
  }

  async function unpinTodo(todoId: string): Promise<void> {
    const result = await execUnpin({ todoId })
    if (result.error) throw result.error
    executeQuery({ requestPolicy: 'network-only' })
  }

  return { todos, fetching, error, search, filterAssignedTo, createTodo, pinTodo, unpinTodo }
}
