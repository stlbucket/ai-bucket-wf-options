# admin/workspace/[id] — Workspace Detail UI

## Status
Implemented — GraphQL (2026-07-10). Divergences from the draft are recorded in README.md → Implementation corrections.

## Route
`/tenant/admin/workspace/[id]` → `apps/tenant-app/app/pages/admin/workspace/[id].vue`

## Required Permission
`p:app-admin` in the parent tenant; the page only shows rows the child-workspace RLS policies
allow. A direct navigation to a non-child tenant id renders the not-found state (query returns
null).

## Layout

`WorkspaceDetail.vue` inside the page; back-link "← Workspaces" to the index.

### Summary card (`UCard`, UC4)
- Header: workspace name + status badge (colors as index list), right-aligned actions:
  - `UButton` "Enter" (`i-lucide-log-in`) — visible when the current user has a residency and
    the workspace is active
  - `UButton` "Deactivate" (`color: error`, variant `soft`) when status is active /
    "Reactivate" (`color: primary`, variant `soft`) when inactive — both behind a
    `UModal` confirmation ("Deactivating blocks every resident of this workspace. Continue?")
- Body: definition list — identifier (`—` when null), type (`workspace`), created, updated,
  subscription pack(s) with status badge

### Residents card (`UCard`)
- Title "Residents" with count
- Table: display name, email, status badge, type, licenses (comma-joined `licenseTypeKey`s)
- Read-only — managing residents happens **inside** the workspace (enter it, use the normal
  admin/user pages); a muted caption states this
- `overflow-x-auto` (UC5)

**Resident status badge colors** (match admin/user conventions):
| Status | Color |
|---|---|
| active | success |
| invited | info |
| inactive | neutral |
| blocked_* / declined | error |

## User Interactions
| Action | Trigger | Condition |
|---|---|---|
| Enter workspace | "Enter" | own residency, workspace active |
| Deactivate | "Deactivate" → confirm modal | status active |
| Reactivate | "Reactivate" → confirm modal | status inactive |
| Back to list | back-link | — |

Post-action feedback via `useToast` (UC7); status badge and buttons re-derive after the
network-only re-query.

## Reactive State
- `confirmAction: ref<'deactivate' | 'activate' | null>` — drives the confirm modal
- `entering: ref(false)` — Enter button spinner
- All data from `useWorkspaceDetail(route.params.id)`; no local copies
