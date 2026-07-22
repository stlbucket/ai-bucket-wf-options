// POST /auth/api/setup/initialize
//
// First-run setup (spec: .claude/specs/first-run-setup/setup.data.md). Unauthenticated,
// pre-claims (R5 carve-out) — no session exists yet, so every DB touch is db-access raw pg and
// ZITADEL is called with the seeder PAT. Guarded in EVERY environment by a mandatory SETUP_TOKEN.
//
// Gate order (a wrong token never reveals whether setup already ran):
//   0. SETUP_TOKEN — fail closed (500) if unset; constant-time compare, 403 on mismatch
//   1. required fields → 400
//   2. soft anchor gate → 409
//   3. ZITADEL user first (idempotent) → 422 complexity reject / 502 unavailable
//   4. initialize_anchor (hard-gated) → 409 race / 500 db error
//   5. { ok: true }  (the page then auto-redirects into the ZITADEL OIDC login)

import { timingSafeEqual } from 'node:crypto'
import { anchorExists, initializeAnchor } from '@function-bucket/fnb-db-access'
import { createHumanUser } from '../../utils/zitadel-admin'

type SetupBody = {
  tenantName?: string
  email?: string
  password?: string
  setupToken?: string
  displayName?: string
  firstName?: string
  lastName?: string
  phone?: string
}

function respond(event: import('h3').H3Event, status: number, body: Record<string, unknown>) {
  setResponseStatus(event, status)
  return body
}

// Constant-time comparison that never throws and does not leak length via early return timing
// beyond the unavoidable length check (timingSafeEqual requires equal-length buffers).
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function localPart(email: string): string {
  return email.split('@')[0] || email
}

export default defineEventHandler(async (event) => {
  const body = await readBody<SetupBody>(event)

  // 0. SETUP_TOKEN gate — fail closed, constant-time, before any ZITADEL/DB side effect.
  const expected = process.env.SETUP_TOKEN
  if (!expected) return respond(event, 500, { error: 'SETUP_NOT_CONFIGURED' })
  const provided = typeof body?.setupToken === 'string' ? body.setupToken : ''
  if (!tokenMatches(provided, expected)) return respond(event, 403, { error: 'INVALID_SETUP_TOKEN' })

  // 1. required fields
  for (const field of ['tenantName', 'email', 'password'] as const) {
    const v = body?.[field]
    if (!v || typeof v !== 'string') return respond(event, 400, { error: 'INVALID_INPUT', field })
  }
  const tenantName = body.tenantName as string
  const email = body.email as string
  const password = body.password as string

  // 2. soft gate (the DB function enforces this hard too; this avoids touching ZITADEL).
  if (await anchorExists()) return respond(event, 409, { error: 'SETUP_ALREADY_COMPLETE' })

  // 3. ZITADEL user FIRST (idempotent) — a lost response / DB failure can be safely retried.
  let created
  try {
    created = await createHumanUser({
      email,
      password,
      givenName: body.firstName || localPart(email),
      familyName: body.lastName || localPart(email),
    })
  } catch (err) {
    console.error('setup/initialize: ZITADEL user creation failed', err)
    return respond(event, 502, { error: 'ZITADEL_UNAVAILABLE' })
  }
  if (!created.ok) {
    return respond(event, 422, { error: 'ZITADEL_REJECTED', message: created.message })
  }

  // 4. Initialize the DB (hard-gated inside app_fn.initialize_anchor).
  try {
    await initializeAnchor({
      tenantName,
      email,
      displayName: body.displayName ?? null,
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      phone: body.phone ?? null,
    })
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.code === '42501' || /SETUP_ALREADY_COMPLETE/.test(e.message ?? '')) {
      return respond(event, 409, { error: 'SETUP_ALREADY_COMPLETE' })
    }
    console.error('setup/initialize: initializeAnchor failed', err)
    return respond(event, 500, { error: 'DB_ERROR' })
  }

  return { ok: true }
})
