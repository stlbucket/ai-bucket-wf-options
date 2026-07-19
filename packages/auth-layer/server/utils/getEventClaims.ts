import { claimsForSession } from '@function-bucket/fnb-db-access'
import type { H3Event } from 'h3'
import { readAppSession } from './session'

export async function getEventClaims(event: H3Event) {
  // Sealed session (0010): unseal failures (forged/tampered/expired/legacy cookie)
  // read as an empty session — unauthenticated, not an error. Legacy { id }-only
  // payloads (pre session-refresh-pattern.md) have no sid and also read as
  // unauthenticated: one forced re-login at deploy, no dual-read shim.
  const { id: userId, sid } = await readAppSession(event)

  if (!userId || !sid) return { user: undefined, claims: undefined }

  // Validity is decided by the auth.session row (revoked → idle 24h → absolute 7d),
  // touched+validated and turned into claims in one DB round trip. Invalid/unknown
  // session or a DB error during validation → unauthenticated, never a 500.
  try {
    const claims = await claimsForSession(sid)
    if (!claims) return { user: undefined, claims: undefined }
    return { user: { id: userId }, claims }
  } catch {
    return { user: undefined, claims: undefined }
  }
}
