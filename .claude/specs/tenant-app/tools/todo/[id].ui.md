# tools/todo/[id] — Todo Detail UI

> **URN-registry migration (2026-07-10):** the `<module>_tenant`/`<module>_resident` mirror
> tables, `ensure_<module>_resident`, and the `handle_update_profile` triggers described below
> are **removed**. Resident references are now URN columns (`posted_by_resident_urn`,
> `resident_urn` — `text REFERENCES res.resource(urn)`); `tenant_id` FKs point at
> `app.tenant(id)`; display names resolve via `resourceBy…Urn { resident { displayName } }`;
> the resident picker is the shared `residentsList` query (`ActiveTenantResidents`). Registered
> tables carry a generated `urn` column. Authoritative contract: `.claude/specs/urn-registry/`
> (`_shared.data.md` §5–§6). Mirror-table details below are historical.


## Status
Implemented — GraphQL. The **Attachments** section (spec'd + implemented 2026-07-09, issue 0480)
replaced the static `TodoDetailAttachments.vue` placeholder with the real asset stack.

## Route
`/tenant/tools/todo/[id]` → `apps/tenant-app/app/pages/tenant/tools/todo/[id].vue`

## Required Permission
`p:app-user` or `p:app-admin`

## Layout
`ClientOnly` wrapper containing a `UCard` that fills available height (`flex flex-col grow`).

| Breakpoint | Component |
|---|---|
| `md` and above | `TodoDetail` |
| below `md` | `TodoDetailSmall` |

Both components receive `todoTree` as a prop and emit action events.

## Component: `TodoDetail`
*To be created at `apps/tenant-app/app/components/todo/TodoDetail.vue`*

Props: `todoTree: TodoTree` (the full nested result from `TodoById` query)

Emits:
| Event | Payload | Triggered by |
|---|---|---|
| `@new-location` | `LocationInfoInput` | User adds a location to the todo |
| `@update-location` | `LocationInfoInput` | User edits the existing location |
| `@clone-template` | — | User clones this template into a new todo |
| `@make-template` | — | User converts this todo into a template |
| `@delete` | `todoId: string` | User deletes this todo |

Display sections:
- **Header**: todo `name` — click to edit inline (contenteditable or `UInput` swapped in on click); `type` badge; `status` badge; pin/unpin icon button (`i-lucide-pin` / `i-lucide-pin-off`)
- **Description**: click to edit inline; shows placeholder text when empty
- **Status actions**: `UButtonGroup` or dropdown to change status (`incomplete`, `complete`, `archived`, `unfinished`)
- **Assignee**: display resident `displayName`; "Assign" `UButton` opens a `USelect` of tenant residents (all `todo.todo_resident` for the tenant)
- **Location**: show linked location name if present; "Add Location" / "Edit Location" `UButton` opens a `UModal` with a simple text form (name, address fields, optional lat/lon — no map picker)
- **Subtasks**: nested list of child todos (up to 4 levels from query); each child shows name + status badge + inline status toggle; "Add subtask" button at each level
- **Actions bar**: Delete, Make Template / Clone Template (depending on `isTemplate`), back to list link (`← All Todos`)

### Template vs Regular Todo behavior
| `isTemplate` | Actions shown |
|---|---|
| `false` | "Make Template" button |
| `true` | "Clone Template" button (creates a new regular todo from this template); template badge in header |

## Component: `TodoDetailSmall`
*To be created at `apps/tenant-app/app/components/todo/TodoDetailSmall.vue`*

Same props and emits as `TodoDetail`, optimized for mobile:
- Collapsed sections (UAccordion or similar)
- Subtask list uses compact row format
- Same action events

## Status Badge Colors
Same as index page — see `index.ui.md`.

## Reactive State
```ts
const todoTree = ref<TodoTree | null>(null)
```
Loaded from `TodoById` query on mount.

## User Interactions
| Action | Result |
|---|---|
| Change status | `updateTodoStatus()` → refreshes todoTree |
| Edit name/description | `updateTodo()` → refreshes todoTree |
| Add subtask | `createTodo({ parentTodoId: id })` → reload |
| Toggle subtask status | `updateTodoStatus(childId, status)` → reload |
| Delete | Confirm dialog → `deleteTodo()` → `navigateTo('/tenant/tools/todo')` |
| Make Template | `makeTemplateFromTodo()` → `navigateTo('/tenant/tools/todo/{newId}')` |
| Clone Template | `makeTodoFromTemplate()` → `navigateTo('/tenant/tools/todo/{newId}')` |
| Add location | Emit `new-location` with LocationInfoInput → `createLocation()` → reload |
| Edit location | Emit `update-location` with LocationInfoInput → `updateLocation()` → reload |
| Assign resident | `assignTodo(todoId, residentId)` → reload |

## Attachments (right rail)
*Spec'd 2026-07-09 (issue `0480__storage___todo-detail-asset-attachments`) — replaces the static
placeholder `TodoDetailAttachments.vue`. Asset types, badge colors, and the upload/scan flow are
owned by `.claude/specs/asset-storage/` (`_shared.data.md`, `components.ui.md`); this section only
specs the todo embedding. Data contract: `[id].data.md` → Attachments.*

The implemented `TodoDetail` renders a toggleable right rail (`w-80`, "Attachments · Discussion"
button, persisted in localStorage) containing Attachments above the Discussion (`TodoMsg`).
`TodoDetailSmall` renders Attachments inside its accordion. Both reuse the same component.

### Component: `TodoDetailAttachments` (rewrite)
Props:
```ts
import type { Asset } from '@function-bucket/fnb-types'
{ todoId: string, assets: Asset[] }
```
Emits (page owns all data calls — R2):
| Event | Payload | Triggered by |
|---|---|---|
| `@uploaded` | `AssetMeta` | `AssetUploader` succeeds (202) — page refreshes the asset list |
| `@delete-asset` | `assetId: string` | User confirms delete in the modal |

- **Header row**: `ATTACHMENTS · {assets.length}` label + an **Upload** button that opens a
  `UModal` hosting storage-layer's `AssetUploader` with `context="TODO"`,
  `:owning-entity-id="todoId"`, `:allow-public="false"` (todo attachments are always private).
  On `@uploaded`: close the modal, re-emit. The uploader owns its POST — the documented R2
  exception (`components.ui.md`).
- **Rows** (compact, one per asset — the rail is 320px, no table):
  - extension chip: `UBadge color="neutral" variant="subtle"` with `asset.extension` uppercased
    (the placeholder's raw Tailwind chip colors violate UC6 — do not keep them)
  - name: `ULink` to `` `/assets/${asset.id}` `` (base-relative — resolves under the app base once
    tenant-app extends storage-layer; never hardcode `/storage/…`), truncated
  - second line: human-readable `sizeBytes` · scan-status `UBadge` via `statusColor('asset', …)`
    with the asset-local labels ("Malware scan pending…", "Scan error") — `PENDING` is the normal
    state right after upload
  - download `UButton icon="i-lucide-download"` **only when `downloadUrl !== null`**
    (`:to="downloadUrl" target="_blank"`)
  - delete `UButton icon="i-lucide-x"` → confirm `UModal` ("Delete {originalName}?") → emit
    `@delete-asset` (same confirm-then-emit pattern as todo delete)
- **Empty state** (UC8): `UEmpty icon="i-lucide-folder-open" label="No attachments"` (compact).
- Icons to verify per UC11: `i-lucide-download`, `i-lucide-x`, `i-lucide-folder-open` (all
  previously verified present — `components.ui.md`).

### Host wiring
`TodoDetail` and `TodoDetailSmall` gain an `assets: Asset[]` prop and re-emit
`@uploaded` / `@delete-asset` up to the page, like every other todo emit.

### Attachment interactions
| Action | Result |
|---|---|
| Click Upload → stage file → Upload | `AssetUploader` POST → 202 toast → `@uploaded` → page refreshes asset list (scan verdict arrives later) |
| Click download icon | Opens `downloadUrl` (presigned) in a new tab |
| Click asset name | `navigateTo('/assets/{id}')` — asset detail page |
| Click x → confirm | `@delete-asset` → page deletes → refreshes asset list |

## Decisions
- **Attachments presentation** (2026-07-09): compact rail rows, not the `AssetList` table — the
  rail is `w-80`
- **Attachments visibility** (2026-07-09): private-only (`allowPublic=false`); `is_public` is
  immutable after upload
- **Attachments delete** (2026-07-09): in v1, with confirm modal
- **Attachments detail link** (2026-07-09): name links to `/assets/[id]`; download button also
  stays in the row
- **Uploader placement** (2026-07-09): `AssetUploader`'s staged flow doesn't fit the 320px rail
  inline — hosted in a `UModal` opened by the header Upload button
- **Editing**: inline click-to-edit for name and description (no separate modal)
- **Pin**: pin/unpin button visible on the detail page header
- **Location**: UModal with simple text form; no map picker
- **Residents for assign**: all `todo.todo_resident` for the current tenant
- **Status refresh**: `TodoByIdForRefresh` after status changes; full `TodoById` reload after structural changes (add/delete subtask, assign, location update, name/description edit)
