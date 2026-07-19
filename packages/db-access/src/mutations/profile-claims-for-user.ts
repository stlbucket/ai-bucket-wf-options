import { query } from '@/pool'
import { camelCaseKeys } from '@/utils/camel-case'
import { normalizeClaims } from '@/utils/normalize-claims'
import type { ProfileClaims } from '@function-bucket/fnb-types'

// SECURITY DEFINER, granted to `authenticator`. The auth middleware / WS upgrade bootstraps claims
// from the `session` cookie's userId on every request. Returns undefined when the user resolves to
// no claims (e.g. no active residency).
export async function profileClaimsForUser(userId: string): Promise<ProfileClaims | undefined> {
  const rows = await query<{ claims: Record<string, unknown> | null }>(
    `select to_jsonb(app_fn.profile_claims_for_user($1::uuid)) as claims`,
    [userId],
  )
  const claims = rows[0]?.claims
  if (!claims) return undefined
  return normalizeClaims(camelCaseKeys<ProfileClaims>(claims))
}
