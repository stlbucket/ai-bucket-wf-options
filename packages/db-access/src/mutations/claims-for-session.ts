import { query } from '@/pool'
import { camelCaseKeys } from '@/utils/camel-case'
import { normalizeClaims } from '@/utils/normalize-claims'
import type { ProfileClaims } from '@function-bucket/fnb-types'

// The per-request choke point (replaces the claims-only currentProfileClaims call on the
// middleware/WS paths): app_fn.claims_for_session validates the auth.session row
// (revoked → idle 24h → absolute 7d), touches last_seen_at (throttled to 1h), and builds the
// claims — one DB round trip. Invalid/unknown session → null → unauthenticated (fail closed).
// Spec: .claude/specs/future-auth/session-refresh-pattern.md.
export async function claimsForSession(sessionId: string): Promise<ProfileClaims | null> {
  const rows = await query<{ claims: Record<string, unknown> | null }>(
    `select app_fn.claims_for_session($1::uuid) as claims`,
    [sessionId],
  )
  const claims = rows[0]?.claims
  if (!claims) return null
  return normalizeClaims(camelCaseKeys<ProfileClaims>(claims))
}
