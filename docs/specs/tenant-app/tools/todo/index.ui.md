# tools/todo/index — Todo List UI

> **Multi-assignee refactor (implemented 2026-07-30):** the assignee column is an avatar
> group and the header gained an "Assigned to me" toggle. Contract: `README.md` / `_shared.data.md`.

## Status
Implemented — GraphQL (status trued up 2026-07-19 by the recurring spec/code reconciliation; no [FILL IN] markers remained and the pages/composables exist as specified). **Multi-assignee sections: Implemented 2026-07-30.**

## Route
`/tenant/tools/todo` → `apps/tenant-app/app/pages/tenant/tools/todo/index.vue`

## Required Permission
`p:app-user` or `p:app-admin` (enforced by nav tool entry; DB enforces `p:todo` on mutations)

## Layout
Single `UCard` with a header toolbar and a responsive list body.

### Header
Three rows stacked:
1. Title row: `"Todo"` (text-2xl) left, **New Todo** action button right
2. Search row: label `"SEARCH TERM"` (text-xs) above a `UInput` bound to `searchTerm`
3. Template toggle row: `UButton` — label toggles between `"Show Templates"` / `"Hide Templates"` based on `showTemplates` ref; alongside it an **"Assigned to me"** toggle `UButton` (multi-assignee, 2026-07-28) bound to `assignedToMe` — on: `filterAssignedTo(myResidentUrn)`, off: `filterAssignedTo(null)`; fires immediately (no debounce); hidden while `showTemplates` is on (templates carry no assignees)

### Body
| Breakpoint | Component |
|---|---|
| `md` and above | `TodoList` |
| below `md` | `TodoListSmall` |

Both components receive the `todos` array as a prop.

## Component: `TodoList`
*To be created at `apps/tenant-app/app/components/todo/TodoList.vue`*

Props: `todos: TodoSummary[]`

- Table layout (responsive, `overflow-x-auto`)
- Columns: name, status badge, type badge, assignees (multi-assignee 2026-07-28: initials-avatar group, first 3 + "+N" overflow, `displayName` tooltips; "—" when empty), updatedAt
- Each row is clickable → navigate to `/tenant/tools/todo/{id}`
- Pinned todos sorted to the top of the list; a pin icon (`i-lucide-pin`) shown inline on pinned rows

## Component: `TodoListSmall`
*To be created at `apps/tenant-app/app/components/todo/TodoListSmall.vue`*

Props: `todos: TodoSummary[]`

- Compact card or list row per todo
- Shows: name, status badge, type
- Tap → navigate to `/tenant/tools/todo/{id}`

## Component: `TodoModal`
*To be created at `apps/tenant-app/app/components/todo/TodoModal.vue`*

Emits: `@updated(todo)` with the newly created todo object
Props: `showTextButton: boolean` — when true renders a text `UButton`; otherwise an icon button

- Opens a `UModal` with a form: name (required, min 3 chars), description (optional)
- Submit → emits `updated` with the form values
- The parent page calls `createTodo` then navigates to the new `[id]` page

## Status Badge Colors
| Status | Nuxt UI color |
|---|---|
| `INCOMPLETE` | warning (yellow) |
| `COMPLETE` | success (green) |
| `ARCHIVED` | neutral (gray) |
| `UNFINISHED` | error (red) |

## Type Badge
| Type | Display |
|---|---|
| `TASK` | no badge (default) |
| `MILESTONE` | info (blue) badge |

## Reactive State
```ts
const showTemplates = ref(false)
const searchTerm = ref('')
const assignedToMe = ref(false) // multi-assignee, 2026-07-28
```
`showTemplates`, `searchTerm`, and `assignedToMe` feed the composable query variables.

## User Interactions
| Action | Result |
|---|---|
| Type in search | 300ms debounce → `search(searchTerm, showTemplates)` |
| Toggle Templates button | Flip `showTemplates`; immediately call `search(searchTerm, !showTemplates)` — switches to templates-only view |
| Toggle "Assigned to me" | Flip `assignedToMe`; `filterAssignedTo(assignedToMe ? myResidentUrn : null)` — immediate, no debounce |
| Click todo row | `navigateTo('/tenant/tools/todo/{id}')` |
| Click New Todo → submit modal | `createTodo()` → `navigateTo('/tenant/tools/todo/{newId}')` |

**Template toggle behavior**: when `showTemplates = true` the list shows only templates (`isTemplate=true`). Regular todos are hidden. The list header label changes to `"Templates"`. Toggle back to switch to regular todos.
