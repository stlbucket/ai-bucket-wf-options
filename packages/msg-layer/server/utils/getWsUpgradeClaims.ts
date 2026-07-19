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

export async function getWsUpgradeClaims(headers: Headers) {
  const cookieHeader = headers.get('cookie') || ''
  const sealed = parseCookieValue(cookieHeader, 'session')
  if (!sealed) return { user: undefined, claims: undefined }

  // Sealed session (0010): there is no H3Event during a WS upgrade, but unsealSession only
  // reads the config (password/maxAge) — the event parameter is unused in h3's implementation.
  // Any unseal failure (forged/tampered/expired cookie) → unauthenticated, never a throw.
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

  // Same choke point as the HTTP middleware (session-refresh-pattern.md): the auth.session row
  // decides validity (revoked/idle/absolute) and the touch-renewal happens server-side, so the
  // cookie-less WS upgrade path gets identical behavior. Any DB error → unauthenticated rather
  // than throwing out of the WS upgrade.
  try {
    const claims = await claimsForSession(sid)
    return claims ? { user: { id: userId }, claims } : { user: undefined, claims: undefined }
  } catch {
    return { user: undefined, claims: undefined }
  }
}
