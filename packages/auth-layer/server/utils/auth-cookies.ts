import { deleteCookie } from 'h3'
import type { H3Event } from 'h3'
import { clearAppSession } from './session'

// The sealed `session` cookie itself is managed by session.ts (issue 0010). This clears the
// whole auth cookie surface: the sealed session plus the legacy readable claims cookie left
// over from before claims moved to localStorage.
export async function deleteAuthCookies(event: H3Event) {
  const { cookieDomain } = useRuntimeConfig(event)
  await clearAppSession(event)
  deleteCookie(event, 'auth.user', {
    sameSite: 'lax',
    secure: true,
    httpOnly: false,
    domain: (cookieDomain as string) || undefined,
  })
}
