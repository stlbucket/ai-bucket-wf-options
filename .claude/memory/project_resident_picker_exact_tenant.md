---
name: project_resident_picker_exact_tenant
description: Resident pickers must pin rows to the subject's EXACT tenant_id — app.resident RLS spans the workspace tree, so unpinned pickers leak parent/sibling-workspace residents
metadata:
  type: project
---

RLS on `app.resident` makes residents visible across the **workspace tenant tree** (nested
tenants / workspace-tenants feature), not just the caller's current tenant. Any resident
picker that queries `residentsList` without an explicit tenant pin will therefore show
residents from the top-level tenant and sibling workspaces (user correction 2026-07-30,
todo multi-assignee).

**Why:** PostGraphile `residentsList` has only an equality `condition` (no
connection-filter plugin), and RLS is the tree, not the leaf.

**How to apply:** filter client-side in the composable against the *subject entity's* own
`tenant_id` (e.g. `r.tenantId === todo.tenantId` in `useTodoDetail.residents`), never
against just "whatever RLS returns". The shared picker query is `ResidentPicker`
(`graphql/app/query/residentsList.graphql`, renamed from `ActiveTenantResidents`
2026-07-30): it fetches all statuses and every consumer filters client-side — todo
assignees = exact tenant + `ACTIVE|INVITED`; msg participants + poll share = `ACTIVE`
(their pre-2026-07-30 behavior; note they are NOT tenant-pinned yet — same latent leak).
