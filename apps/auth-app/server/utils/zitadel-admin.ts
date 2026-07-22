// ZITADEL management-API client for first-run setup (spec: .claude/specs/first-run-setup/).
//
// Runtime analog of docker/zitadel/seed.mjs's user seeding: creates the FIRST human user from
// the /auth/setup form on a virgin env. Reuses the same transport the OIDC client uses
// (server/utils/oidc.ts) — node:http against the container-internal origin
// (runtimeConfig.zitadelInternalUrl) carrying the EXTERNAL domain in the Host header (derived
// from runtimeConfig.zitadelIssuer), because ZITADEL resolves its instance from Host and fetch
// forbids overriding it. Authenticated with the FirstInstance seeder PAT read from the shared
// zitadel-seed volume (process.env.ZITADEL_PAT_FILE). No new NUXT_ZITADEL_* aliases (resolved
// 2026-07-21): the URLs come from the existing runtimeConfig keys.

import { readFile } from 'node:fs/promises'
import http from 'node:http'

type AdminContext = {
  internalHostname: string
  internalPort: string
  externalHost: string
  pat: string
  orgId: string
}

type ZitadelResponse = { status: number; json: unknown }

let cached: Promise<AdminContext> | null = null

function patFilePath(): string {
  return process.env.ZITADEL_PAT_FILE || '/zitadel-seed/admin.pat'
}

function requireStr(name: string, value: unknown): string {
  if (!value || typeof value !== 'string') {
    throw new Error(`zitadel-admin: runtimeConfig.${name} is not set`)
  }
  return value
}

// Cached PAT + resolved org. Failures are not cached (PAT file may not exist yet on a cold boot).
export function getZitadelAdminContext(): Promise<AdminContext> {
  if (!cached) {
    cached = buildContext().catch((err) => {
      cached = null
      throw err
    })
  }
  return cached
}

async function buildContext(): Promise<AdminContext> {
  const rc = useRuntimeConfig()
  const issuer = requireStr('zitadelIssuer', rc.zitadelIssuer)
  const internal = new URL(requireStr('zitadelInternalUrl', rc.zitadelInternalUrl))
  const pat = (await readFile(patFilePath(), 'utf8')).trim()
  if (!pat) throw new Error(`zitadel-admin: PAT file ${patFilePath()} is empty`)

  const ctx: AdminContext = {
    internalHostname: internal.hostname,
    internalPort: internal.port,
    externalHost: new URL(issuer).host,
    pat,
    orgId: '',
  }
  ctx.orgId = await resolveOrg(ctx)
  return ctx
}

// node:http transport with the external Host header + Bearer PAT (mirrors seed.mjs's api()).
// x-zitadel-orgid is sent only once the org is known (orgs/me must run without it).
function request(
  ctx: AdminContext,
  method: string,
  path: string,
  body?: unknown,
): Promise<ZitadelResponse> {
  const payload = body === undefined ? null : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: ctx.internalHostname,
        port: ctx.internalPort,
        path,
        method,
        headers: {
          host: ctx.externalHost,
          authorization: `Bearer ${ctx.pat}`,
          'content-type': 'application/json',
          ...(ctx.orgId ? { 'x-zitadel-orgid': ctx.orgId } : {}),
          ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          let json: unknown = null
          try {
            json = data ? JSON.parse(data) : null
          } catch {
            json = { raw: data }
          }
          resolve({ status: res.statusCode ?? 0, json })
        })
      },
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function resolveOrg(ctx: AdminContext): Promise<string> {
  const res = await request(ctx, 'GET', '/management/v1/orgs/me')
  const orgId = (res.json as { org?: { id?: string } } | null)?.org?.id
  if (res.status !== 200 || !orgId) {
    throw new Error(`zitadel-admin: orgs/me failed (${res.status})`)
  }
  return orgId
}

function isAlreadyExists(res: ZitadelResponse): boolean {
  return (
    res.status === 409 ||
    (res.status === 400 && /already exists/i.test(JSON.stringify(res.json ?? '')))
  )
}

function messageOf(res: ZitadelResponse): string {
  const j = res.json as { message?: string; raw?: string } | null
  return j?.message || j?.raw || `ZITADEL returned ${res.status}`
}

export type CreateHumanUserResult =
  | { ok: true; created: boolean }
  | { ok: false; kind: 'rejected'; message: string } // 4xx validation/complexity — maps to 422

// Idempotent create of a ZITADEL human user with the person's chosen password (changeRequired
// false — first-run-setup decision 2026-07-21). Returns:
//   { ok: true, created: true }   → newly created
//   { ok: true, created: false }  → already exists (safe retry / re-run)
//   { ok: false, kind: 'rejected' } → a 4xx validation/complexity rejection (surface verbatim, 422)
// Transport failures, a missing/empty PAT, and 5xx THROW (the caller maps those to 502).
export async function createHumanUser(input: {
  email: string
  givenName: string
  familyName: string
  password: string
}): Promise<CreateHumanUserResult> {
  const ctx = await getZitadelAdminContext()
  const res = await request(ctx, 'POST', '/v2/users/human', {
    username: input.email,
    organization: { orgId: ctx.orgId },
    profile: { givenName: input.givenName, familyName: input.familyName },
    email: { email: input.email, isVerified: true },
    password: { password: input.password, changeRequired: false },
  })

  if (res.status === 200 || res.status === 201) return { ok: true, created: true }
  if (isAlreadyExists(res)) return { ok: true, created: false }
  if (res.status >= 400 && res.status < 500) {
    return { ok: false, kind: 'rejected', message: messageOf(res) }
  }
  // 5xx / unexpected — transport-level failure
  throw new Error(`zitadel-admin: create human user failed (${res.status}): ${messageOf(res)}`)
}

// ── Invitation onboarding ceremony (spec: .claude/specs/user-invitation/) ────────────────────
// The auth-app onboard routes (verify-email / request-password / set-password) call these. The
// invite itself (create human user + email #1) is done by the n8n `invite-user` workflow, not
// here. Contract confirmed against v4.15.3 (2026-07-22) — see zitadel-admin-client.md:
//   verify email    POST /v2/users/{id}/email/verify       { verificationCode }   (NO underscore)
//   request reset   POST /v2/users/{id}/password_reset      { returnCode: {} } → { verificationCode }
//   set password    POST /v2/users/{id}/password            { newPassword, verificationCode }
//   get user        GET  /v2/users/{id}
// A ZITADEL 4xx on a code call means the single-use code is bad/expired/consumed; 5xx (or transport
// failure) THROWS so the route maps it to 502.

// A code was bad/expired/consumed (the emailed link no longer works).
export type CodeExpired = { ok: false; kind: 'expired'; message: string }

// Verify a user's email with the code carried by email #1 (auto-verify on the verify-email page).
export async function verifyEmail(
  userId: string,
  verificationCode: string,
): Promise<{ ok: true } | CodeExpired> {
  const ctx = await getZitadelAdminContext()
  const res = await request(ctx, 'POST', `/v2/users/${encodeURIComponent(userId)}/email/verify`, {
    verificationCode,
  })
  if (res.status === 200 || res.status === 201) return { ok: true }
  if (res.status >= 400 && res.status < 500) return { ok: false, kind: 'expired', message: messageOf(res) }
  throw new Error(`zitadel-admin: verify email failed (${res.status}): ${messageOf(res)}`)
}

// Mint a single-use password-reset code (return-code mode) for the set-password link in email #2.
// Works for any existing user regardless of email-verified state (confirmed 2026-07-22).
export async function requestPasswordReset(
  userId: string,
): Promise<{ ok: true; verificationCode: string } | CodeExpired> {
  const ctx = await getZitadelAdminContext()
  const res = await request(ctx, 'POST', `/v2/users/${encodeURIComponent(userId)}/password_reset`, {
    returnCode: {},
  })
  const code = (res.json as { verificationCode?: string } | null)?.verificationCode
  if ((res.status === 200 || res.status === 201) && code) return { ok: true, verificationCode: code }
  if (res.status >= 400 && res.status < 500) return { ok: false, kind: 'expired', message: messageOf(res) }
  throw new Error(`zitadel-admin: password_reset failed (${res.status}): ${messageOf(res)}`)
}

// Set the invitee's chosen password using the reset code from email #2. `changeRequired:false` —
// they just picked it. A bad/expired code and a password-policy violation are both ZITADEL 4xx;
// they are distinguished so the page can show "expired link" vs. the policy message.
export type SetPasswordResult =
  | { ok: true }
  | CodeExpired
  | { ok: false; kind: 'policy'; message: string }

export async function setPassword(
  userId: string,
  verificationCode: string,
  password: string,
): Promise<SetPasswordResult> {
  const ctx = await getZitadelAdminContext()
  const res = await request(ctx, 'POST', `/v2/users/${encodeURIComponent(userId)}/password`, {
    newPassword: { password, changeRequired: false },
    verificationCode,
  })
  if (res.status === 200 || res.status === 201) return { ok: true }
  if (res.status >= 400 && res.status < 500) {
    // ZITADEL flags a bad/expired/consumed reset code distinctly from a policy rejection. The code
    // errors reference the code/verification; anything else on a 4xx is a complexity/policy fail.
    const msg = messageOf(res)
    if (/code|verification|expired/i.test(msg)) return { ok: false, kind: 'expired', message: msg }
    return { ok: false, kind: 'policy', message: msg }
  }
  throw new Error(`zitadel-admin: set password failed (${res.status}): ${messageOf(res)}`)
}

// ── Self-service change password (spec: .claude/specs/password-self-service/) ─────────────────
// Set a new password after ZITADEL verifies the CURRENT one (call D). Confirmed live v4.15.3
// (2026-07-22 probe): correct current → 200; wrong current → 400 with a typed
// `zitadel.v1.CredentialsCheckError` detail; a policy/complexity fail → 400 with a different
// `zitadel.v1.ErrorDetail`. We discriminate on the detail @type (robust — not string-matching).
// `changeRequired:false` — the user just chose it. 5xx / transport failure THROWS (caller → 502).
export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; kind: 'wrong-current'; message: string } // → 401
  | { ok: false; kind: 'policy'; message: string } // → 422

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const ctx = await getZitadelAdminContext()
  const res = await request(ctx, 'POST', `/v2/users/${encodeURIComponent(userId)}/password`, {
    newPassword: { password: newPassword, changeRequired: false },
    currentPassword,
  })
  if (res.status === 200 || res.status === 201) return { ok: true }
  if (res.status >= 400 && res.status < 500) {
    const details = (res.json as { details?: Array<{ '@type'?: string }> } | null)?.details ?? []
    const wrongCurrent = details.some((d) => (d?.['@type'] ?? '').includes('CredentialsCheckError'))
    const message = messageOf(res)
    return wrongCurrent
      ? { ok: false, kind: 'wrong-current', message }
      : { ok: false, kind: 'policy', message }
  }
  throw new Error(`zitadel-admin: change password failed (${res.status}): ${messageOf(res)}`)
}

// Fetch a user (the request-password route needs the email + display name to build email #2).
export async function getUser(userId: string): Promise<{
  email: string
  displayName: string
} | null> {
  const ctx = await getZitadelAdminContext()
  const res = await request(ctx, 'GET', `/v2/users/${encodeURIComponent(userId)}`)
  if (res.status !== 200) return null
  const human = (res.json as { user?: { human?: { email?: { email?: string }; profile?: { displayName?: string } } } } | null)
    ?.user?.human
  const email = human?.email?.email
  if (!email) return null
  return { email, displayName: human?.profile?.displayName || email }
}
