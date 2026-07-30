# Plan: Resident pickers — pin msg + poll pickers to the subject's exact tenant

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> Small, client-layer-only fix; no DB work. House precedent: `useTodoDetail.residents`
> (fixed 2026-07-30, plan `0610__app_______todo-multi-assignee`). Background memory:
> `.claude/memory/project_resident_picker_exact_tenant.md`.

**Severity: MED** (cross-workspace resident-name visibility in pickers) · Category: app
· Identified: 2026-07-30 (user correction during the todo multi-assignee round-trip test)

## Context

RLS on `app.resident` spans the **workspace tenant tree**, not the leaf tenant. The shared
picker query `ResidentPicker` (`packages/graphql-client-api/src/graphql/app/query/
residentsList.graphql`, renamed from `ActiveTenantResidents` 2026-07-30) fetches all rows
RLS allows and leaves filtering to the consuming composable. The todo assignee picker was
pinned to the todo's own `tenant_id` on 2026-07-30; two consumers still are not:

- `useMsgTopics.useMsgResidents` (`packages/graphql-client-api/src/composables/useMsgTopics.ts`)
  — msg participants picker; filters `status === 'ACTIVE'` only.
- `usePollDetail.residents` (`packages/graphql-client-api/src/composables/usePollDetail.ts`)
  — poll ShareModal picker; filters `status === 'ACTIVE'` only.

Both therefore list active residents from parent/sibling workspaces. This predates
2026-07-30 (the old `condition: { status: ACTIVE }` had the same tree-wide scope) — it was
made *visible* by the todo picker work, not caused by it.

## Fix approach

Mirror the todo fix: filter client-side on the subject entity's own tenant —
`String(r.tenantId) === String(<subject tenant id>)`.

- **msg**: the participants picker runs in the *current* tenant context (new-conversation
  modal) — pin to the caller's `tenantId` from claims (`useAuth`), or thread it in as an
  argument to `useMsgResidents()` (composable lives in `graphql-client-api`, which must not
  import `auth-ui` — passing the tenant id in from the page/layer is the clean shape).
- **poll**: `usePollDetail` already loads the poll — pin to `poll.tenantId` exactly like
  `useTodoDetail` pins to `data.value?.todo?.tenantId`.
- Decide per-picker whether `INVITED` residents belong (todo assignees include them; msg
  participants arguably should too — an invited resident can be messaged the moment they
  activate; poll share is OTP-based and tenant-scoped, so invited inclusion is defensible).
  Ask the user before widening either.

## Verification

- `pnpm -F @function-bucket/fnb-graphql-client-api build` clean; `pnpm build` gate.
- In a nested-workspace dev tenant: msg new-conversation picker and poll ShareModal list
  only the current workspace's residents.

## Completion

Ask the user (AskUserQuestion): move this plan to `addressed/`?
