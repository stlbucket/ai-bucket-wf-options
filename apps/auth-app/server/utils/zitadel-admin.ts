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
