# admin/workspace/index — Workspace List UI

## Status
Implemented — GraphQL (2026-07-10). Divergences from the draft are recorded in README.md → Implementation corrections.

## Route
`/tenant/admin/workspace` → `apps/tenant-app/app/pages/admin/workspace/index.vue`

## Required Permission
`p:app-admin` (tool `tenant-admin-workspaces`; page itself renders only data RLS allows)

## Layout

`UCard` (UC4) as the page container:
- Header: title "Workspaces", subtitle "Nested workspaces of {current tenant name}",
  right-aligned `UButton` "New Workspace" (`i-lucide-plus`, color `primary`)
- Body: `WorkspaceList.vue` table (empty state: `UAlert`-free — a muted "No workspaces yet"
  line with the create button)
- `WorkspaceCreateModal.vue` mounted at page level

## Component: `WorkspaceList.vue`
Props: `workspaces: WorkspaceView[]`
Emits: `enter(workspace)`, `open(workspace)`

- Columns: name (link → `/tenant/admin/workspace/{id}`), status badge, identifier (muted, `—`
  when null), created date, membership (your residency), actions
- Membership cell: `UBadge` — "member" (`primary`) when `myResidentId` present, otherwise
  "not a member" (`neutral`)
- Actions cell: `UButton` "Enter" (`i-lucide-log-in`, size `xs`) — rendered only when
  `canEnter`; disabled with `UTooltip` "This workspace is inactive" when the workspace is
  inactive but a residency exists
- Responsive: `overflow-x-auto` wrapper (UC5)

**Status badge colors** (matches site-admin tenant list):
| Status | Color |
|---|---|
| active | success |
| paused | warning |
| inactive / other | neutral |

## Component: `WorkspaceCreateModal.vue`
Props: `open: boolean`
Emits: `update:open`, `created(tenant)`

- `UModal` with `UForm`: fields **Name** (`UInput`, required) and **Identifier**
  (`UInput`, optional, hint "leave blank unless you need a stable key")
- Submit "Create workspace" (`primary`, loading state) / Cancel
- On success: `useToast` "Workspace {name} created" (UC7), emit `created`, close
- On error: toast with the message; the sibling-duplicate error (`30002`) surfaces as
  "A workspace with this name already exists"

## User Interactions
| Action | Trigger | Condition |
|---|---|---|
| Open workspace detail | Click name / `open` | — |
| Create workspace | "New Workspace" → modal → submit | `p:app-admin` |
| Enter workspace | "Enter" button | `canEnter` (own residency, workspace active) — switches active residency, refreshes claims, navigates to `/tenant` |

## Reactive State
- `createModalOpen: ref(false)`
- `entering: ref<string | null>(null)` — workspace id currently being entered (button spinner)
- List data entirely from `useWorkspaces()` (no local copies)
