import { defineEventHandler, getQuery, createError } from 'h3'
import { getDeepLink } from '@function-bucket/fnb-db-access'

// Unauthenticated (pre-claims) read for the OTP landing page (/auth/go/[id]). Returns only the
// masked, non-sensitive deep-link projection — an unknown/expired/revoked id comes back with the
// flags set so the page shows a dead-link state (no enumeration signal beyond that).
// Spec: .claude/specs/otp-login/ (go.data.md).
export default defineEventHandler(async (event) => {
  const id = String(getQuery(event).id ?? '').trim()
  if (!id) throw createError({ statusCode: 400, data: { error: 'invalid' } })
  const deepLink = await getDeepLink(id)
  return { deepLink }
})
