import type { ProfileClaims } from '@function-bucket/fnb-types'

// The JWT payload shape the RLS helpers read from `request.jwt.claims` — jwt.uid(),
// jwt.tenant_id(), jwt.has_permission() etc. pull from user_metadata. Ported verbatim from the
// retired fnb-db-types with-claims so the DB sees an identical payload.
interface JwtUserMetadata {
  profile_id: string | null
  tenant_id: string | null
  resident_id: string | null
  actual_resident_id: string | null
  permissions: string[]
}

export interface JwtPayload {
  email: string | null
  display_name: string | null
  user_metadata: JwtUserMetadata
}

export function buildJwtPayload(claims: ProfileClaims): JwtPayload {
  return {
    email: claims.email,
    display_name: claims.displayName,
    user_metadata: {
      profile_id: claims.profileId,
      tenant_id: claims.tenantId,
      resident_id: claims.residentId,
      actual_resident_id: claims.actualResidentId,
      permissions: claims.permissions ?? [],
    },
  }
}
