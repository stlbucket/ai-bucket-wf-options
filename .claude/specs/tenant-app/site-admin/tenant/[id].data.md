# site-admin/tenant/[id] — Tenant Detail Data

## Status
Implemented — GraphQL (detail + mutations + read-only users / subscriptions extension, built
2026-07-27 via plan `0160`; the same-day **reversal** removed the cross-tenant invite delta —
see the README's Reversal note. `pnpm build` gate passed, manual e2e pending).

> **Extended by `../../admin/nestable-tenant-types/`** (2026-07-23): the Type `USelect` becomes
> context-aware — nested tenants (`parentTenantId != null`) offer `{workspace, client,
> organization}`, roots offer `{anchor, customer, demo, test, trial}`. The detail query must
> select `parentTenantId`. That spec is authoritative.

> **Extends `.claude/specs/user-invitation/`** (2026-07-27): this spec added the synchronous
> **link mode** to the `invite-user` workflow/trigger contract that spec owns (specified here,
> single write-up; that spec's README carries a pointer back). The cross-tenant `targetTenantId`
> pass-through this note originally also covered was **removed the same day** (reversal — super
> admins use support mode); link mode survives for the tenant-admin resend + U9 checkbox.

## Route
`/tenant/site-admin/tenant/[id]` — see `[id].ui.md` for UI details

## RLS grounding (why no new DB work)

`p:app-admin-super` already holds cross-tenant **read** policies on `app.resident`,
`app.license`, and `app.tenant_subscription` (`db/fnb-app/deploy/00000000010250_app_policies.sql`
lines 58 / 106 / 90), so the users + licenses + subscriptions reads below are plain PostGraphile
queries — **zero DDL, zero new policies**. This page is read-only beyond the tenant mutations:
user management happens inside the tenant via support mode (reversal 2026-07-27).

## GraphQL

### Query: `AppTenantById` (extended)
- File: `packages/graphql-client-api/src/graphql/app/query/appTenantById.graphql`
- Generated hook: `useTenantByIdQuery()` in `src/generated/fnb-graphql-api.ts`
- Variable: `$tenantId: UUID!`
- Returns null (not 404) if tenant not found — composable handles gracefully

Extend the selection (the `residents { totalCount }` count node is **replaced** by the full
list — count becomes `residents.length` client-side):

```graphql
query TenantById($tenantId: UUID!) {
  tenant(id: $tenantId) {
    ...Tenant
    residents: residentsList(orderBy: [CREATED_AT_ASC]) {
      ...Resident
      licenses: licensesList {
        id
        licenseTypeKey
        status
      }
    }
    tenantSubscriptions: tenantSubscriptionsList {
      ...TenantSubscription
      licensePack {
        displayName
      }
      licenses: licenses {
        totalCount
      }
    }
  }
}
```

Field-name note: `residentsList` / `licensesList` follow the same V5 list inflection already used
in `residentById.graphql`. Confirm the singular FK field name for
`tenant_subscription.license_pack_key → app.license_pack` in the generated schema (expected
`licensePack`; add a smart tag in `apps/graphql-api-app/postgraphile.tags.json5` only if
inflection disagrees).

### Mutations (existing — unchanged)

| Operation | GraphQL | Generated hook |
|---|---|---|
| Activate tenant | `ActivateAppTenant($tenantId)` | `useActivateTenantMutation()` |
| Deactivate tenant | `DeactivateAppTenant($tenantId)` | `useDeactivateTenantMutation()` |
| Update tenant name/identifier/type | `UpdateTenant` | `useUpdateTenantMutation()` |
| Enter support mode | `BecomeSupport` | `useBecomeSupportMutation()` (via `useBecomeSupport()`) |

Subscriptions are **read-only** on this page (locked decision) — the existing
`DeactivateTenantSubscription` / `ReactivateTenantSubscription` mutations are *not* wired here.

## Invite dispatch — the `triggerWorkflow` carve-out

Invites are **not GraphQL mutations** (user-invitation U6): they dispatch the n8n `invite-user`
workflow through `triggerWorkflow`. **This page no longer dispatches invites at all** (reversal
2026-07-27) — the section below documents the **link mode** delta this spec contributed, which
survives for the tenant-admin resend (`admin/user/[id]`) and the U9 checkbox.

### ~~Delta 1 — `targetTenantId` pass-through~~ — REMOVED (reversal 2026-07-27)

Built, then removed the same day by user directive. The trigger plugin stamps
`tenantId: claims.tenantId` over `inputData` unconditionally — there is **no cross-tenant
dispatch**; a super admin enters support mode to invite into another tenant. The registry entry
is back to `'invite-user': { permission: 'p:app-admin' }`.

### Delta 2 — synchronous **link mode** (workflow + plugin + composable) — KEPT

`n8n/workflows/invite-user.json` changes:
- Webhook `responseMode`: `onReceived` → `lastNode` (the workflow is two fast HTTP calls; the
  email path stays sub-second, the ZITADEL path ~1–2 s — acceptable sync).
- Payload gains `mode: 'email' | 'link'` (default `'email'`).
- After the ZITADEL Code node, an IF on `mode`:
  - `email` → existing Send Email HTTP node (POST `send-notification`), then the respond payload
  - `link` → **skip** Send Email
- Final **Respond payload** Code node (last node — its first-entry JSON is the webhook response):
  `{ link: string | null, template: 'user-invitation' | 'set-password', sent: boolean }` —
  `link` is the ceremony URL the workflow already builds
  (`/auth/verify-email?userId=..&code=..`, or `/auth/set-password?...` on the 409 re-invite
  path), `sent` is false in link mode.

Plugin response handling: parse the webhook response body as JSON (best-effort — `null` on
parse failure or fire-and-forget `onReceived` workflows) into a new nullable `result: JSON`
field on `TriggerWorkflowResult`:

```graphql
type TriggerWorkflowResult { accepted: Boolean!, runId: String, result: JSON }
```

`useTriggerWorkflow` (`packages/graphql-client-api/src/composables/useTriggerWorkflow.ts`)
selects + returns `result`. Existing callers ignore it — non-breaking.

**Security note:** link mode returns a single-use ZITADEL code to the caller instead of the
invitee's inbox. Gate is unchanged (`p:app-admin`, own tenant only) — an admin who can trigger
the email could already intercept-and-forward it; the run is still logged in
`n8n.workflow_run`.

### Composable — `useInviteUser` (extended with `mode` only)

**Source:** `packages/graphql-client-api/src/composables/useInviteUser.ts`
**Re-export:** `apps/tenant-app/app/composables/useInviteUser.ts` (existing)

```ts
export interface InviteUserInput {
  displayName: string
  email: string
  mode?: 'email' | 'link'        // default 'email'  (targetTenantId removed — reversal)
}

export interface InviteUserResult {
  accepted: boolean
  link: string | null            // set in link mode (from TriggerWorkflowResult.result)
  template: 'user-invitation' | 'set-password' | null
}
```

`invite(input)` passes `mode` through `triggerWorkflow('invite-user', …)` and shapes `result`
into `InviteUserResult`. Throws on `!accepted` (unchanged).

## Composable — `useSiteAdminTenant` (extended)

**Source:** `packages/graphql-client-api/src/composables/useSiteAdminTenants.ts` (`useSiteAdminTenant`)
**Re-export:** `apps/tenant-app/app/composables/useSiteAdminTenants.ts`

View types (R4 — declared in the composable file):

```ts
export interface TenantUserView {
  residentId: string
  profileId: string | null
  displayName: string | null
  email: string
  status: string                 // INVITED | ACTIVE | … (GraphQL enum casing)
  type: string                   // HOME | GUEST (SUPPORT rows filtered out)
  licenseTypeKeys: string[]      // active licenses only
}

export interface TenantSubscriptionView {
  id: string
  licensePackKey: string
  displayName: string | null     // pack displayName (fallback to key in the UI)
  status: string
  licenseCount: number
}
```

| Export | Return shape | Usage |
|---|---|---|
| `useSiteAdminTenant(id)` | `{ data: ComputedRef<Tenant \| null>, users: ComputedRef<TenantUserView[]>, subscriptions: ComputedRef<TenantSubscriptionView[]>, fetching, error, refresh, activate, deactivate, update }` | `[id].vue` setup |

`users` filters `type !== 'SUPPORT'` and maps each resident's active licenses to
`licenseTypeKeys`; `subscriptions` maps `tenantSubscriptions` + `licensePack.displayName` +
`licenses.totalCount`. (`refresh` exists on the composable; the page no longer needs it — the
invite-and-refresh flow left with the reversal.)

## Types
See `../_shared.data.md` → Tenant, Resident/License/TenantSubscription fragments, GraphQL
Operations, Support Mode Flow (GraphQL).

## Open Questions
- [x] ~~Confirm the generated FK field name `licensePack` on `TenantSubscription`~~ — resolved
      2026-07-27: `licensePack?: Maybe<LicensePack>` exists in the generated schema; no smart tag.
