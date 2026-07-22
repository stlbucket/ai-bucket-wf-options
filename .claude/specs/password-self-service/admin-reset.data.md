# Admin Reset — tenant-app "send password reset" action

## Status
Draft. The **"p:app-admin in their tenant"** half of the RLS ask, realized as a *reset email*
(user pick 2026-07-22: admin never sets/knows the password). A button on the **existing**
tenant-app user detail page fires the same `forgot-password` workflow for the target user's email.
No new page (no `.ui.md` pair — this is one button + one composable on `admin/user/[id]`).

## UI (small addition to `apps/tenant-app/app/pages/tenant/admin/user/[id].vue`)
- A **"Send password reset"** button (`UButton`, `variant="outline"`, `icon="i-lucide-key-round"`),
  shown only when the viewer holds `p:app-admin` (reuse the page's existing permission check /
  `useAuth`).
- Click → `UModal` confirm ("Email <name> a link to set a new password?") → on confirm call
  `useAdminResetPassword().reset(email)`.
- Success toast (UC7): "Reset link sent to <email>." Error toast on failure.
- The target `email` is **already loaded on this page** (the user detail already displays the
  resident) — it was fetched through RLS-gated GraphQL, so it is by construction an address in a
  tenant the admin can see (`app.resident` policies `view_all_for_tenant` /
  `manage_own_tenant_residencies`).

## Trigger (composable → `triggerWorkflow`)
Mirror `useInviteUser()` (user-invitation) — a thin carve-out over the claims-gated
`triggerWorkflow` mutation, re-exported per app:

```ts
// packages/graphql-client-api/src/composables/useAdminResetPassword.ts
export function useAdminResetPassword() {
  const { executeMutation } = useTriggerWorkflowMutation()
  async function reset(email: string) {
    const res = await executeMutation({
      workflowKey: 'forgot-password',
      inputData: { email },
    })
    if (res.error) throw res.error
    return res.data?.triggerWorkflow?.accepted ?? false
  }
  return { reset }
}
```
```ts
// apps/tenant-app/app/composables/useAdminResetPassword.ts — thin re-export
export { useAdminResetPassword } from '@function-bucket/fnb-graphql-client-api'
```

## Registry (`trigger-workflow.plugin.ts`)
```ts
'forgot-password': { permission: 'p:app-admin' }
```
- Gated `p:app-admin` — parity with `invite-user`. `triggerWorkflow` injects the admin's
  `tenantId`/`profileId`; the workflow ignores them and reads only `email`.
- Same workflow the public route hits — identical `{ email }` body, so the workflow is unchanged.

## Tenant-scoping — how it holds, and the residual
**Holds because:** the only email an admin can put in the field is one the user-detail page loaded
for them, and that load is RLS-scoped to residents in the admin's tenant (+ direct child
workspaces). The registry gate ensures only `p:app-admin` can trigger at all. Composition:
p:app-admin × RLS-visible email = a user in their tenant.

**Residual (Open Question / Phase 2):** the registry gate does not itself re-derive the tenant from
the email — a hand-crafted `triggerWorkflow('forgot-password', { email: <arbitrary> })` by any
`p:app-admin` would pass the gate. **Bounded harm:** it only emails that address a set-password
link (the target must still click + set their own password; the admin gains nothing). Hardened
variant if we want strict enforcement: pass a `residentId` instead of `email`, and resolve the
email inside a `SECURITY DEFINER app_fn.resident_email_for_reset(_resident_id)` that asserts
`jwt.has_permission('p:app-admin', r.tenant_id)` — moving the tenant check server-side into the DB.
Deferred; v1 accepts the bounded-harm residual (recorded in `_shared.data.md` Open Questions).

## Errors
| Condition | Result |
|---|---|
| accepted | success toast "Reset link sent" |
| not `p:app-admin` | button not shown; mutation would `30000 NOT AUTHORIZED` |
| workflow trigger fails | error toast |

The email itself is best-effort/async: if the address has no ZITADEL user the workflow no-ops
silently (same as the public flow) — the admin still sees "sent" (the trigger was accepted). That
is acceptable for an admin action (no enumeration concern here — the admin already knows the user
exists in the tenant).
