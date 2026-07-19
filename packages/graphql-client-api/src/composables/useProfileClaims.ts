import type { Client } from '@urql/vue'
import { CurrentProfileClaimsDocument } from '../generated/fnb-graphql-api'
import type {
  CurrentProfileClaimsQuery,
  CurrentProfileClaimsQueryVariables,
} from '../generated/fnb-graphql-api'
import type {
  ProfileClaims,
  ResidentStatus,
  ResidentType,
  TenantStatus,
  TenantType,
} from '@function-bucket/fnb-types'

// Imperative fetch of the current profile's claims, assembled into the hand-written ProfileClaims
// shape. Used on demand (after login / session change / startup hydration), so it takes a urql
// Client directly rather than being a reactive hook. Returns null when there is no logged-in
// profile (e.g. no valid session cookie), which callers treat as "logged out".
export async function fetchProfileClaims(client: Client): Promise<ProfileClaims | null> {
  const result = await client
    .query<CurrentProfileClaimsQuery, CurrentProfileClaimsQueryVariables>(
      CurrentProfileClaimsDocument,
      {},
      { requestPolicy: 'network-only' },
    )
    .toPromise()
  if (result.error) throw result.error

  const cpc = result.data?.currentProfileClaims
  // An invalid session yields a composite row of all-null fields (jwt.uid() is null), not a null
  // row — treat it as logged out too, so all-null claims can never reach localStorage
  // (claims-revalidation-pattern.md). profileId is set for every real login, even pre-residency.
  if (!cpc || cpc.profileId == null) return null

  const modules = (result.data?.availableModules ?? [])
    .filter((m): m is NonNullable<typeof m> => m != null)
    .map((m) => ({
      key: m.key ?? null,
      name: m.name ?? null,
      permissionKeys: (m.permissionKeys ?? null) as string[] | null,
      defaultIconKey: m.defaultIconKey ?? null,
      ordinal: m.ordinal ?? null,
      tools: (m.toolsByModuleKeyList ?? [])
        .filter((t): t is NonNullable<typeof t> => t != null)
        .map((t) => ({
          key: t.key ?? null,
          name: t.name ?? null,
          permissionKeys: (t.permissionKeys ?? null) as string[] | null,
          defaultIconKey: t.defaultIconKey ?? null,
          route: t.route ?? null,
          ordinal: t.ordinal ?? null,
        })),
    }))

  return {
    profileId: cpc.profileId ?? null,
    tenantId: cpc.tenantId ?? null,
    residentId: cpc.residentId ?? null,
    actualResidentId: cpc.actualResidentId ?? null,
    profileStatus: (cpc.profileStatus ?? null) as ProfileClaims['profileStatus'],
    permissions: (cpc.permissions ?? null) as string[] | null,
    email: cpc.email ?? null,
    displayName: cpc.displayName ?? null,
    tenantName: cpc.tenantName ?? null,
    modules,
    residencies: (result.data?.myResidencyTreeList ?? [])
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((r) => ({
        tenantId: String(r.tenantId),
        tenantName: r.tenantName ?? '',
        tenantType: r.tenantType as unknown as TenantType,
        tenantStatus: r.tenantStatus as unknown as TenantStatus,
        parentTenantId: r.parentTenantId ? String(r.parentTenantId) : null,
        residentId: r.residentId ? String(r.residentId) : null,
        residentStatus: (r.residentStatus ?? null) as ResidentStatus | null,
        residentType: (r.residentType ?? null) as ResidentType | null,
      })),
  }
}
