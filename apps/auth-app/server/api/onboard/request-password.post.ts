import { defineEventHandler, readBody, createError } from 'h3'
import { requestPasswordReset, getUser } from '../../utils/zitadel-admin'
import { readOnboardVerified } from '../../utils/onboard-cookie'

// Unauthenticated onboarding route (user-invitation spec, verify-email.data.md). The /verify-email
// page calls this when the invitee clicks "send me a link to set my password". It mints a ZITADEL
// password-reset code (return-code mode) and emails the set-password link (email #2) via the
// internal send-notification webhook.
//
// U5 anti-abuse: it REQUIRES the onboard_verified cookie set by verify-email and matching this
// userId — so only someone who just verified this user's email can trigger the reset mail (the
// reset code itself is the credential; this stops open "spam a reset email by userId" abuse).
export default defineEventHandler(async (event) => {
  const body = await readBody<{ userId?: string }>(event)
  const userId = body?.userId?.trim()
  if (!userId) throw createError({ statusCode: 400, data: { error: 'invalid' } })

  const verified = await readOnboardVerified(event)
  if (verified.userId !== userId) throw createError({ statusCode: 401, data: { error: 'not_verified' } })

  let reset, user
  try {
    reset = await requestPasswordReset(userId)
    user = await getUser(userId)
  } catch {
    throw createError({ statusCode: 502, data: { error: 'unavailable' } })
  }
  if (!reset.ok || !user) throw createError({ statusCode: 502, data: { error: 'unavailable' } })

  const authAppUrl = String(useRuntimeConfig(event).public.authAppUrl) // http://localhost:4000/auth
  const setPasswordUrl =
    `${authAppUrl}/set-password?userId=${encodeURIComponent(userId)}&code=${encodeURIComponent(reset.verificationCode)}`

  // email #2 — internal server-to-server webhook (shared secret), same shape the triggerWorkflow
  // plugin + the invite-user workflow POST. NB: use the service name; localhost → ::1 (n8n is IPv4).
  const n8nUrl = process.env.N8N_INTERNAL_URL
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (!n8nUrl || !secret) throw createError({ statusCode: 502, data: { error: 'unavailable' } })
  try {
    await $fetch(`${n8nUrl}/webhook/send-notification`, {
      method: 'POST',
      headers: { 'x-fnb-webhook-secret': secret },
      body: {
        channel: 'email',
        templateKey: 'set-password',
        to: user.email,
        subject: 'Set your fnb password',
        vars: { displayName: user.displayName, setPasswordUrl },
        tenantId: null,
        profileId: null,
      },
    })
  } catch {
    throw createError({ statusCode: 502, data: { error: 'unavailable' } })
  }

  return { ok: true }
})
