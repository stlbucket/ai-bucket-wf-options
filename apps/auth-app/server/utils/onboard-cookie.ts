import { useSession, getSession, clearSession, createError } from 'h3'
import type { H3Event, SessionConfig } from 'h3'

// Short-lived sealed httpOnly cookie proving the holder just verified THIS ZITADEL user's email
// (U5 anti-abuse, user-invitation spec). It gates POST /api/onboard/request-password so only
// someone who completed the email verify for a given userId can trigger its password-reset email —
// without it the route is an open "email a reset code by userId" endpoint. Reuses the sealed-cookie
// mechanism + NUXT_SESSION_SECRET of the main session cookie (auth-layer session.ts), but is a
// SEPARATE, ~15-min cookie so it can never be mistaken for an authenticated session.

export type OnboardVerifiedData = { userId?: string; email?: string; displayName?: string }

const NAME = 'onboard_verified'
const MAX_AGE = 60 * 15 // 15 minutes — long enough to click "send me a link", short-lived otherwise

function onboardConfig(event: H3Event): SessionConfig {
  const { sessionSecret, cookieDomain } = useRuntimeConfig(event)
  if (!sessionSecret || String(sessionSecret).length < 32) {
    throw createError({ statusCode: 500, message: 'NUXT_SESSION_SECRET must be set to at least 32 characters' })
  }
  return {
    password: String(sessionSecret),
    name: NAME,
    maxAge: MAX_AGE,
    cookie: { sameSite: 'lax', secure: true, domain: (cookieDomain as string) || undefined },
  }
}

export async function setOnboardVerified(event: H3Event, data: OnboardVerifiedData): Promise<void> {
  const session = await useSession<OnboardVerifiedData>(event, onboardConfig(event))
  await session.update(data)
}

export async function readOnboardVerified(event: H3Event): Promise<OnboardVerifiedData> {
  try {
    const session = await getSession<OnboardVerifiedData>(event, onboardConfig(event))
    return session.data
  } catch {
    return {}
  }
}

export async function clearOnboardVerified(event: H3Event): Promise<void> {
  await clearSession(event, onboardConfig(event))
}
