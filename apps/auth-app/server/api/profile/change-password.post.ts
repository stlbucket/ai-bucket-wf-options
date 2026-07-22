import { defineEventHandler, readBody, createError } from 'h3'
import { withClaims, selectMyIdpUserId } from '@function-bucket/fnb-db-access'
import { changeOwnPassword } from '../../utils/zitadel-admin'

// Authenticated, SELF-ONLY change password (password-self-service spec, change-password.data.md).
// The target ZITADEL user is derived from the SESSION, never from the body: selectMyIdpUserId runs
// under withClaims and app.profile RLS `view_self` (jwt.uid() = id) restricts it to the caller's own
// row — this is the whole "only the owning user" gate. ZITADEL additionally verifies the current
// password. Deliberately NOT an n8n workflow: a chosen password must never transit the run log.
export default defineEventHandler(async (event) => {
  const claims = event.context.claims
  if (!claims) throw createError({ statusCode: 401, data: { error: 'unauthenticated' } })

  const body = await readBody<{ current?: string; next?: string }>(event)
  const current = body?.current
  const next = body?.next
  if (!current || !next) throw createError({ statusCode: 400, data: { error: 'invalid' } })
  // Server-side floor (never trust the client); ZITADEL is the authority for the full policy and
  // returns any violation verbatim as a 422 below.
  if (next.length < 8) {
    throw createError({
      statusCode: 422,
      data: { error: 'policy', message: 'Password must be at least 8 characters.' },
    })
  }
  if (next === current) {
    throw createError({
      statusCode: 400,
      data: { error: 'same', message: 'New password must be different from the current one.' },
    })
  }

  // RLS-gated self-read of the ZITADEL user id (view_self) — never accepts a target from the body.
  const idpUserId = await withClaims(claims, (client) => selectMyIdpUserId(client))
  if (!idpUserId) throw createError({ statusCode: 409, data: { error: 'no-idp-user' } })

  let result
  try {
    result = await changeOwnPassword(idpUserId, current, next)
  } catch {
    throw createError({ statusCode: 502, data: { error: 'unavailable' } })
  }
  if (result.ok) return { ok: true }
  if (result.kind === 'wrong-current') {
    throw createError({ statusCode: 401, data: { error: 'wrong-current' } })
  }
  throw createError({ statusCode: 422, data: { error: 'policy', message: result.message } })
})
