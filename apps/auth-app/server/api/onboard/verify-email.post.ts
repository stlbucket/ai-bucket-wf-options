import { defineEventHandler, readBody, createError } from 'h3'
import { verifyEmail } from '../../utils/zitadel-admin'
import { setOnboardVerified } from '../../utils/onboard-cookie'

// Unauthenticated onboarding route (user-invitation spec, verify-email.data.md). Auto-called by the
// /verify-email page on load with the code from email #1. Verifies the ZITADEL email, and on
// success sets the short-lived onboard_verified cookie (U5) that gates request-password. Not the
// GraphQL stack — a legitimate REST/H3 carve-out like the OIDC callback (the invitee has no session).
export default defineEventHandler(async (event) => {
  const body = await readBody<{ userId?: string; code?: string }>(event)
  const userId = body?.userId?.trim()
  const code = body?.code?.trim()
  if (!userId || !code) throw createError({ statusCode: 400, data: { error: 'invalid' } })

  let result
  try {
    result = await verifyEmail(userId, code)
  } catch {
    throw createError({ statusCode: 502, data: { error: 'unavailable' } })
  }
  // Bad / expired / already-consumed code → the page shows the "expired link" state.
  if (!result.ok) throw createError({ statusCode: 410, data: { error: 'expired' } })

  await setOnboardVerified(event, { userId })
  return { ok: true }
})
