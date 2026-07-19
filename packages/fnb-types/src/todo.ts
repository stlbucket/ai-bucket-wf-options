// Plain flat shape for todo.todo. Enum values mirror the GraphQL TodoStatus / TodoType (UPPERCASE).

export type TodoStatus = 'INCOMPLETE' | 'COMPLETE' | 'ARCHIVED' | 'UNFINISHED'

export type TodoType = 'TASK' | 'MILESTONE'

import type { Urn } from '@/urn'

export interface Todo {
  id: string
  tenantId: string
  residentUrn: Urn | null
  name: string
  description: string | null
  type: TodoType
  status: TodoStatus
  ordinal: number
  pinned: boolean
  tags: string[]
  parentTodoId: string | null
  rootTodoId: string
  isTemplate: boolean
  createdAt: Date
  updatedAt: Date
  urn: Urn
}
