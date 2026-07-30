# workspace-switcher — Data Contract

Types, DB functions, permissions: see `_shared.data.md`.

## Status
Implemented — GraphQL (claims delivery), 2026-07-10. Decisions locked 2026-07-10 (revised same
day: delivery via `ProfileClaims.residencies`). Corrections: README §Implementation corrections.

## GraphQL — extend the claims document (no new operation)

`packages/graphql-client-api/src/graphql/app/query/currentProfileClaims.graphql` gains a third
top-level field, following the `availableModules` precedent:

```graphql
query CurrentProfileClaims {
  currentProfileClaims { …existing… }
  availableModules: … { …existing… }
  myResidencyTreeList {
    tenantId
    tenantName
    tenantType
    tenantStatus
    parentTenantId
    residentId
    residentStatus
    residentType
  }
}
```

Every field of the record type is selected (house rule). Codegen re-run; no new hook — the
existing `CurrentProfileClaimsDocument` carries it.

Existing operations reused: `AssumeResident` (via `assumeResidency` in `useResidency.ts`).

## `fetchProfileClaims` — `packages/graphql-client-api/src/composables/useProfileClaims.ts` (extend)

Map the new field into the returned claims, mirroring the `modules` mapping style:

```ts
residencies: (result.data?.myResidencyTreeList ?? [])
  .filter((r): r is NonNullable<typeof r> => r != null)
  .map((r) => ({
    tenantId: String(r.tenantId),
    tenantName: r.tenantName,
    tenantType: r.tenantType as unknown as TenantType,
    tenantStatus: r.tenantStatus as unknown as TenantStatus,
    parentTenantId: r.parentTenantId ? String(r.parentTenantId) : null,
    residentId: r.residentId ? String(r.residentId) : null,
    residentStatus: (r.residentStatus ?? null) as ResidentStatus | null,
    residentType: (r.residentType ?? null) as ResidentType | null,
  })),
```

The `db-access` server path (`currentProfileClaims` / `profileClaimsForUser`) sets
`residencies: null` explicitly (see `_shared.data.md` → `ProfileClaims`).

## Switch action — `useAuth().switchResidency(residentId)` (`packages/auth-ui/src/use-auth.ts`, extend)

Identical shape to the neighboring `exitSupport`:

```ts
async function switchResidency(residentId: string): Promise<void> {
  await assumeResidency(getClient(), residentId)     // from graphql-client-api (already a dep)
  await refreshClaims()
  await navigateTo('/', { external: true })          // full reload — the workspace-Enter contract
}
```

Note: the existing `goHome()` is `navigateTo('/')` **without** `{ external: true }` — the
switch must be a full reload (nav/urql caches rebuild under the new tenant), so `switchResidency`
navigates explicitly rather than reusing (or silently changing) `goHome` for its other callers.

Added to `UseAuthReturn` and the returned object. Errors propagate to the caller (the component
toasts them — UC7); on error no navigation happens and claims are untouched.

## Tree derivation — `useResidencySwitcher()` (`packages/auth-ui/src/use-residency-switcher.ts`, new)

Pure claims-derived composable (the `useAppNav`-from-`claims.modules` precedent). Reads
`useAuth().user`; no network activity of its own.

### View type (declared in this file)

```ts
export type ResidencySwitchNode = ResidencyTreeNode & {
  isCurrent: boolean            // residentId === user.residentId
  canEnter: boolean             // residentId != null && !isCurrent
                                //   && tenantStatus === 'ACTIVE'
                                //   && residentStatus ∈ ENTERABLE_STATUSES
  children: ResidencySwitchNode[]
}
```

Ghost nodes (`residentId === null`) always have `isCurrent: false`, `canEnter: false`.
`ENTERABLE_STATUSES` imported from `graphql-client-api` (shared export — see `_shared.data.md`).

### Return shape

| Return | Shape | Notes |
|---|---|---|
| `roots` | `ComputedRef<ResidencySwitchNode[]>` | derived from `user.value?.residencies ?? []`; recomputes when claims refresh. Tree build: index by `tenantId`, attach children via `parentTenantId` (missing parent ⇒ root, defensive), siblings sorted by `tenantName` (`localeCompare`) |
| `switchResidency` | re-exposed from `useAuth` | so the component needs one composable |

Barrel: export from `packages/auth-ui/src/index.ts` (ESM-crash rule).

**Re-export:** `packages/auth-layer/app/composables/useResidencySwitcher.ts` (single line — the
`useAuth.ts` re-export precedent). The tenant-layer component imports it the way `AppNav.vue`
imports `useAuth` (`@function-bucket/fnb-auth-layer/app/composables/…`).

## Refresh-on-open (staleness contract)

Opening the modal awaits `useAuth().refreshClaims()` (the one existing claims round trip);
`roots` recomputes reactively from the refreshed localStorage claims. No switcher-specific
fetch exists.

## Switch flow (component-orchestrated)

1. User selects an enterable node → `switchResidency(node.residentId)`.
2. Inside: `assumeResidency` (deactivates current residency, activates target) →
   `refreshClaims()` → `goHome()` (full reload into home-app; nav re-derives from new claims).
3. On error: toast via `useToast` (UC7), modal stays open, no navigation.

## R24 — dependency declarations

**No new dependencies anywhere.** `auth-ui` already depends on `graphql-client-api`, `fnb-types`,
and `@vueuse/core`; `auth-layer` already depends on `auth-ui`; tenant-layer touches only
`auth-layer` composable re-exports it already resolves. Run `pnpm dep-audit` after the change to
confirm.
