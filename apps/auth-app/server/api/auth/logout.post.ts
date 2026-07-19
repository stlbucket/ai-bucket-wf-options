// POST /api/auth/logout
//
// Ends the current user's session: revokes the auth.session row (server-side revocation —
// session-refresh-pattern.md; a retained copy of the cookie dies immediately, closing 0180)
// and clears the sealed session cookie. Returns 200 { ok: true } UNCONDITIONALLY — revocation
// is best-effort and idempotent; the client must always end up logged out locally.
// The client additionally navigates to GET /api/auth/oidc/logout afterwards to end the
// ZITADEL SSO session (RP-initiated logout).

import { revokeSession } from '@function-bucket/fnb-db-access'

export default defineEventHandler(async (event) => {
  try {
    const { sid } = await readAppSession(event)
    if (sid) await revokeSession(sid)
  } catch {
    // fail open on revocation errors — clearing the cookie still logs this browser out
  }
  await deleteAuthCookies(event)
  return { ok: true }
})
