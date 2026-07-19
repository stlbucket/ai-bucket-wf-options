import type { ProfileClaims, ProfileStatus } from '@function-bucket/fnb-types'

// db-access assembles ProfileClaims from raw pg (to_jsonb), where profileStatus is the lowercase
// pg enum value. fnb-types ProfileStatus mirrors the GraphQL enum (UPPERCASE), so we normalize here
// so the server-assembled claims match the client (GraphQL) path and honor the declared type.
export function normalizeClaims(claims: ProfileClaims): ProfileClaims {
  if (claims.profileStatus) {
    claims.profileStatus = String(claims.profileStatus).toUpperCase() as ProfileStatus
  }
  // app_fn.profile_claims has no residencies field — the raw-pg server path carries an explicit
  // null; only the GraphQL claims path (fetchProfileClaims) populates it.
  claims.residencies ??= null
  return claims
}
