import { defineEventHandler, readBody, createError } from 'h3'
import { verifyOtpLogin, getDeepLink } from '@function-bucket/fnb-db-access'

// Unauthenticated (pre-claims) OTP verify. On success app_fn.verify_otp_login has already switched
// the workspace to the URN's tenant and minted an OTP auth.session — we seal { id, sid } into the
// cookie (identical to the OIDC callback tail) and return the URN's in-app route. A bad/expired/
// exhausted code → 401; a no-residency condition → 403. Spec: .claude/specs/otp-login/ (go.data.md).
export default defineEventHandler(async (event) => {
  const body = await readBody<{ id?: string; code?: string }>(event)
  const id = body?.id?.trim()
  const code = body?.code?.trim()
  if (!id || !code) throw createError({ statusCode: 400, data: { error: 'invalid' } })

  let result
  try {
    result = await verifyOtpLogin(id, code)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('NO_RESIDENCY_IN_TENANT')) throw createError({ statusCode: 403, data: { error: 'no_access' } })
    throw createError({ statusCode: 400, data: { error: 'unavailable' } })
  }
  if (!result) throw createError({ statusCode: 401, data: { error: 'bad_code' } })

  await setAppSession(event, { id: result.profileId, sid: result.sid })

  const deepLink = await getDeepLink(id)
  const redirect = deepLink.subjectUrn ? resolveUrnRoute(deepLink.subjectUrn) : '/'
  return { ok: true, redirect }
})
