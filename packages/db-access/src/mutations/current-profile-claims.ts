import { query } from '@/pool'
import { camelCaseKeys } from '@/utils/camel-case'
import { normalizeClaims } from '@/utils/normalize-claims'
import type { ProfileClaims } from '@function-bucket/fnb-types'

// SECURITY DEFINER; called during login / session-change to assemble fresh claims.
// `to_jsonb(...)` lets pg auto-parse the whole composite (incl. nested modules[]/tools[]) to a JS
// object, avoiding composite-array pg-type parsers; we then camelCase the snake_case keys.
export async function currentProfileClaims(profileId: string): Promise<ProfileClaims> {
  const rows = await query<{ claims: Record<string, unknown> }>(
    `select to_jsonb(app_fn.current_profile_claims($1::uuid)) as claims`,
    [profileId],
  )
  return normalizeClaims(camelCaseKeys<ProfileClaims>(rows[0].claims))
}
