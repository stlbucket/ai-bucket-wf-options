import { defineEventHandler, readBody, createError } from 'h3'
import { requestOtpLogin } from '@function-bucket/fnb-db-access'

// Unauthenticated (pre-claims) OTP request for the deep-link landing page. The opener supplies their
// own phone/email (`identifier`); app_fn.request_otp_login matches it to a resident of the link's
// tenant (D13) and mints a code, delivered to the RAW destination via the internal send-notification
// webhook (the onboard/request-password.post.ts shared-secret pattern). ENUMERATION-SAFE: a contact
// that isn't a tenant resident (dispatch.matched === false) gets the exact same `{ ok: true }`
// response — nothing is sent and the browser cannot tell member from non-member. Spec:
// .claude/specs/otp-login/ (go.data.md).
export default defineEventHandler(async (event) => {
  const body = await readBody<{ id?: string; identifier?: string }>(event)
  const id = body?.id?.trim()
  const identifier = body?.identifier?.trim()
  if (!id || !identifier) throw createError({ statusCode: 400, data: { error: 'invalid' } })

  let dispatch
  try {
    dispatch = await requestOtpLogin(id, identifier)
  } catch (err) {
    // pg raises (check_violation): RESEND_COOLDOWN / DEEP_LINK_UNAVAILABLE
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('RESEND_COOLDOWN')) throw createError({ statusCode: 429, data: { error: 'cooldown' } })
    throw createError({ statusCode: 400, data: { error: 'unavailable' } })
  }

  // Not a resident of the link's tenant → send nothing, respond as success (enumeration-safe).
  if (!dispatch.matched) return { ok: true }

  // Deliver via the internal send-notification webhook (never expose the raw destination/code).
  const n8nUrl = process.env.N8N_INTERNAL_URL
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (!n8nUrl || !secret) throw createError({ statusCode: 502, data: { error: 'unavailable' } })
  try {
    await $fetch(`${n8nUrl}/webhook/send-notification`, {
      method: 'POST',
      headers: { 'x-fnb-webhook-secret': secret },
      body: {
        channel: dispatch.channel,
        templateKey: 'otp-login',
        to: dispatch.destinationRaw,
        subject: dispatch.channel === 'email' ? 'Your fnb login code' : undefined,
        vars: { code: dispatch.code },
        tenantId: null,
        profileId: null,
      },
    })
  } catch {
    throw createError({ statusCode: 502, data: { error: 'unavailable' } })
  }

  return { ok: true }
})
