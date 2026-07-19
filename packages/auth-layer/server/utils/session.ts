import { useSession, getSession, clearSession, createError } from 'h3'
import type { H3Event, SessionConfig } from 'h3'

// Sealed session cookie (issue 0010): the `session` cookie value is an opaque
// encrypted+authenticated blob (h3 useSession → iron-webcrypto) carrying
// { id: <profile uuid>, sid: <auth.session uuid> }. Forged or tampered values
// fail unseal and read as unauthenticated.
//
// Session validity lives in the auth.session ROW, not the seal
// (session-refresh-pattern.md): revocation is immediate, idle timeout 24h,
// absolute cap 7d — all enforced in app_fn.claims_for_session. The cookie is
// written once at login and never re-sealed; the seal's 7d maxAge matches the
// absolute cap as transport-level defense-in-depth only.

export type AppSessionData = { id?: string; sid?: string }

const SESSION_NAME = 'session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7

export function appSessionConfig(event?: H3Event): SessionConfig {
  const { sessionSecret, cookieDomain } = useRuntimeConfig(event)
  // Fail closed: no secret (or a trivially short one) must never degrade to an
  // unsigned cookie. iron requires >= 32 chars of password material.
  if (!sessionSecret || String(sessionSecret).length < 32) {
    throw createError({
      statusCode: 500,
      message: 'NUXT_SESSION_SECRET must be set to at least 32 characters',
    })
  }
  return {
    password: String(sessionSecret),
    name: SESSION_NAME,
    maxAge: SESSION_MAX_AGE,
    cookie: {
      sameSite: 'lax',
      // secure unconditionally — browsers treat http://localhost as trustworthy,
      // so the dev stack (nginx on localhost:PORT) still receives the cookie.
      secure: true,
      domain: (cookieDomain as string) || undefined,
    },
  }
}

export async function setAppSession(event: H3Event, data: AppSessionData): Promise<void> {
  const session = await useSession<AppSessionData>(event, appSessionConfig(event))
  await session.update(data)
}

export async function readAppSession(event: H3Event): Promise<AppSessionData> {
  try {
    const session = await getSession<AppSessionData>(event, appSessionConfig(event))
    return session.data
  } catch {
    // tampered / expired / legacy raw-JSON cookie → unauthenticated, never a 500
    return {}
  }
}

export async function clearAppSession(event: H3Event): Promise<void> {
  await clearSession(event, appSessionConfig(event))
}
