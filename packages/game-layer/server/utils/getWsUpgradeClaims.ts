import { claimsForSession } from '@function-bucket/fnb-db-access'
import { unsealSession } from 'h3'
import type { H3Event } from 'h3'

function parseCookieValue(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) {
      const val = part.slice(idx + 1).trim()
      try { return decodeURIComponent(val) } catch { return val }
    }
  }
}

// msg-layer mirror (sockets-pattern): the sealed `session` cookie → auth.session row →
// claims, on the cookie-less WS upgrade path. Any unseal/DB failure reads as
// unauthenticated, never a throw out of the upgrade.
export async function getWsUpgradeClaims(headers: Headers) {
  const cookieHeader = headers.get('cookie') || ''
  const sealed = parseCookieValue(cookieHeader, 'session')
  if (!sealed) return { user: undefined, claims: undefined }

  // Sealed session (0010): there is no H3Event during a WS upgrade, but unsealSession only
  // reads the config (password/maxAge) — the event parameter is unused in h3's implementation.
  let userId: string | undefined
  let sid: string | undefined
  try {
    const unsealed = await unsealSession(undefined as unknown as H3Event, appSessionConfig(), sealed)
    const data = unsealed.data as { id?: string; sid?: string } | undefined
    userId = data?.id
    sid = data?.sid
  } catch {
    return { user: undefined, claims: undefined }
  }
  if (!userId || !sid) return { user: undefined, claims: undefined }

  // Same choke point as the HTTP middleware (session-refresh-pattern.md): the auth.session
  // row decides validity and touch-renewal happens server-side.
  try {
    const claims = await claimsForSession(sid)
    return claims ? { user: { id: userId }, claims } : { user: undefined, claims: undefined }
  } catch {
    return { user: undefined, claims: undefined }
  }
}
