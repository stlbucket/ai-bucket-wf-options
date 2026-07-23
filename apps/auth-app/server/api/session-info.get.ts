import { defineEventHandler } from 'h3'
import { sessionInfo } from '@function-bucket/fnb-db-access'

// Session metadata for the temporary-session banner. The sid lives in the sealed cookie (not
// claims), so this is a pre-claims read: unseal → app_fn.session_info. Reachable cross-app from
// tenant-app at /auth/api/session-info (same-origin; the httpOnly cookie rides along). No session →
// { session: null }. Spec: .claude/specs/otp-login/ (_shared.data.md §8).
export default defineEventHandler(async (event) => {
  const session = await readAppSession(event)
  if (!session.sid) return { session: null }
  return { session: await sessionInfo(session.sid) }
})
