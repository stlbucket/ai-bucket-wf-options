import { query } from '@/pool'
import { camelCaseKeys } from '@/utils/camel-case'
import type { Profile, ProfileStatus } from '@function-bucket/fnb-types'

// Input for the first-run-setup initializer. Co-located with the mutation (R3/R4 — a
// db-access-local shape, not part of the shared fnb-types vocabulary).
export type InitializeAnchorInput = {
  tenantName: string
  email: string
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
}

// Pre-claims root of trust (first-run-setup, R5 carve-out — same posture as provisionIdpUser):
// called from auth-app's /auth/setup initialize endpoint on a VIRGIN env, BEFORE any claims
// exist, so there is no app_api wrapper. Wraps app_fn.initialize_anchor, which is hard-gated on
// "no anchor tenant yet" (raises SETUP_ALREADY_COMPLETE otherwise). `to_jsonb(...)` +
// camelCaseKeys like provision-idp-user; the raw-pg JSON carries the lowercase enum + ISO
// timestamp strings, normalized to the fnb-types Profile shape here (R3).
export async function initializeAnchor(input: InitializeAnchorInput): Promise<Profile> {
  const rows = await query<{ profile: Record<string, unknown> }>(
    `select to_jsonb(
       app_fn.initialize_anchor($1::citext, $2::citext, $3::citext, $4::citext, $5::citext, $6::citext)
     ) as profile`,
    [
      input.tenantName,
      input.email,
      input.displayName ?? null,
      input.firstName ?? null,
      input.lastName ?? null,
      input.phone ?? null,
    ],
  )
  const profile = camelCaseKeys<Profile>(rows[0].profile)
  profile.status = String(profile.status).toUpperCase() as ProfileStatus
  profile.createdAt = new Date(profile.createdAt as unknown as string)
  profile.updatedAt = new Date(profile.updatedAt as unknown as string)
  return profile
}
