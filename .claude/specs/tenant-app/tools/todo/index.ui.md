# tools/todo/index — Todo List UI

## Status
Draft — fill in all [FILL IN] sections before implementing.

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
3. Template toggle row: `UButton` — label toggles between `"Show Templates"` / `"Hide Templates"` based on `showTemplates` ref

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
- Columns: name, status badge, type badge, assignee (displayName or "—"), updatedAt
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
```
`showTemplates` and `searchTerm` feed the composable query variables.

## User Interactions
| Action | Result |
|---|---|
| Type in search | 300ms debounce → `search(searchTerm, showTemplates)` |
| Toggle Templates button | Flip `showTemplates`; immediately call `search(searchTerm, !showTemplates)` — switches to templates-only view |
| Click todo row | `navigateTo('/tenant/tools/todo/{id}')` |
| Click New Todo → submit modal | `createTodo()` → `navigateTo('/tenant/tools/todo/{newId}')` |

**Template toggle behavior**: when `showTemplates = true` the list shows only templates (`isTemplate=true`). Regular todos are hidden. The list header label changes to `"Templates"`. Toggle back to switch to regular todos.
