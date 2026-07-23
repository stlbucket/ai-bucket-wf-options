import { query } from '@/pool'
import { camelCaseKeys } from '@/utils/camel-case'

// Metadata for the temporary-session banner. `expiresAt` is the sooner of the idle window and the
// absolute cap for this session's auth_method.
export interface SessionInfo {
  authMethod: 'zitadel' | 'otp'
  createdAt: string
  lastSeenAt: string
  expiresAt: string
}

// Pre-claims root of trust: the sid lives in the sealed session cookie (not claims), so the banner
// reads session metadata via an auth-app route, not GraphQL. Revoked/unknown → null.
// Spec: .claude/specs/otp-login/.
export async function sessionInfo(sessionId: string): Promise<SessionInfo | null> {
  const rows = await query<{ info: Record<string, unknown> | null }>(
    `select app_fn.session_info($1::uuid) as info`,
    [sessionId],
  )
  const info = rows[0]?.info
  if (!info) return null
  return camelCaseKeys<SessionInfo>(info)
}
