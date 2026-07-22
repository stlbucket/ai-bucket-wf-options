import { defineEventHandler, readBody, createError } from 'h3'
import { setPassword } from '../../utils/zitadel-admin'

// Unauthenticated onboarding route (user-invitation spec, set-password.data.md). The /set-password
// page posts the chosen password + the reset code from email #2. Sets the password in ZITADEL
// (changeRequired:false — they just chose it). No session is created here: the invitee logs in
// normally afterward via the ZITADEL hosted login (one authentication path), where provision_idp_user
// email-matches and activates the invited resident. The reset code (single-use, possession-proving)
// is the authorization, so no onboard_verified cookie is required here.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ userId?: string; code?: string; password?: string }>(event)
  const userId = body?.userId?.trim()
  const code = body?.code?.trim()
  const password = body?.password
  if (!userId || !code || !password) throw createError({ statusCode: 400, data: { error: 'invalid' } })
  // Server-side complexity floor (never trust the client); ZITADEL is the authority and returns a
  // policy error verbatim for anything it rejects. Mirrors first-run-setup's known dev/prod floor.
  if (password.length < 8) {
    throw createError({ statusCode: 422, data: { error: 'policy', message: 'Password must be at least 8 characters.' } })
  }

  let result
  try {
    result = await setPassword(userId, code, password)
  } catch {
    throw createError({ statusCode: 502, data: { error: 'unavailable' } })
  }
  if (result.ok) return { ok: true }
  if (result.kind === 'expired') throw createError({ statusCode: 410, data: { error: 'expired' } })
  throw createError({ statusCode: 422, data: { error: 'policy', message: result.message } })
})
