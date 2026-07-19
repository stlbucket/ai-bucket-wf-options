// zitadel-seed — idempotent dev seeding of the ZITADEL instance (stage 1 of
// .claude/specs/future-auth/zitadel-login-pattern.md).
//
// Runs once per `docker compose up` (after the zitadel healthcheck), authenticated
// with the FirstInstance machine-user PAT that ZITADEL writes onto the shared
// volume. Ensures:
//   1. project `fnb`
//   2. Web app `fnb-web` — auth method NONE (PKCE), Dev Mode on, redirect/post-logout
//      URIs pointing at the nginx entry point on ${APP_PORT}
//   3. human users mirroring db/seed.sql (same emails, same dev password)
//   4. the { issuer, clientId } handoff JSON on the shared volume (read by auth-app)
//
// Every step is idempotent: existing objects are looked up, never duplicated.
// Any unexpected API response exits non-zero so `docker compose ps` shows the failure.
//
// Plain node:http (not fetch): calls go to the container-internal origin
// (http://zitadel:8080) but MUST carry the external domain in the Host header —
// ZITADEL resolves the instance from Host, and fetch forbids overriding it.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = requiredEnv('ZITADEL_INTERNAL_URL') // http://zitadel:8080
const HOST_HEADER = requiredEnv('ZITADEL_EXTERNAL_HOST') // instance resolution (ExternalDomain)
const ISSUER = requiredEnv('ZITADEL_ISSUER') // external issuer, written to the handoff JSON
const APP_PORT = requiredEnv('APP_PORT') // nginx host port — redirect URIs embed it
const PAT_FILE = requiredEnv('PAT_FILE') // written by ZITADEL FirstInstance PatPath
const SEED_FILE = requiredEnv('SEED_FILE') // { issuer, clientId } handoff for auth-app

const PROJECT_NAME = 'fnb'
const APP_NAME = 'fnb-web'
const REDIRECT_URI = `http://localhost:${APP_PORT}/auth/api/auth/oidc/callback`
const POST_LOGOUT_URI = `http://localhost:${APP_PORT}/`

// Mirrors db/seed.sql — same emails, same dev password ('poiuytre'; the instance's
// password-complexity policy is relaxed in docker-compose.yml to keep this parity).
const SEED_PASSWORD = 'poiuytre'
const SEED_USERS = [
  { email: 'bucket@function-bucket.net', givenName: 'Bucket', familyName: 'Admin' },
  { email: 'tacos-AAA@example.com', givenName: 'Tacos', familyName: 'AAA' },
  { email: 'tacos-BBB@example.com', givenName: 'Tacos', familyName: 'BBB' },
  { email: 'burritos-AAA@example.com', givenName: 'Burritos', familyName: 'AAA' },
  { email: 'burritos-BBB@example.com', givenName: 'Burritos', familyName: 'BBB' },
  { email: 'my-app-tenant-admin@example.com', givenName: 'my-app-tenant', familyName: 'admin' },
  { email: 'my-app-tenant-user@example.com', givenName: 'my-app-tenant', familyName: 'user' },
  { email: 'your-app-tenant-admin@example.com', givenName: 'your-app-tenant', familyName: 'admin' },
  { email: 'your-app-tenant-user@example.com', givenName: 'your-app-tenant', familyName: 'user' },
  { email: 'our-app-tenant-user@example.com', givenName: 'our-app-tenant', familyName: 'user' },
]

// Superset of db/seed-large.sql: 4 tenants x { admin, floater, user-01..07 }. seed-large's
// per-tenant user counts are randomized (4-7), so this seeds the full possible roster —
// extras a given run didn't materialize in the DB are harmless: their first OIDC login just
// provisions a fresh profile with no residencies (app_fn.provision_idp_user email match).
for (let t = 1; t <= 4; t++) {
  const nn = String(t).padStart(2, '0')
  const roles = [
    'admin',
    'floater',
    ...Array.from({ length: 7 }, (_, i) => `user-${String(i + 1).padStart(2, '0')}`),
  ]
  for (const role of roles) {
    SEED_USERS.push({
      email: `large-tenant-${nn}-${role}@example.com`,
      givenName: `large-tenant-${nn}`,
      familyName: role,
    })
  }
}

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`zitadel-seed: missing required env ${name}`)
    process.exit(1)
  }
  return value
}

let pat = ''
let orgId = ''

function api(method, path, body) {
  const url = new URL(path, BASE)
  const payload = body === undefined ? null : JSON.stringify(body)
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          host: HOST_HEADER,
          authorization: `Bearer ${pat}`,
          'content-type': 'application/json',
          ...(orgId ? { 'x-zitadel-orgid': orgId } : {}),
          ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          let json = null
          try {
            json = data ? JSON.parse(data) : null
          } catch {
            json = { raw: data }
          }
          resolve({ status: res.statusCode ?? 0, json })
        })
      },
    )
    request.on('error', reject)
    if (payload) request.write(payload)
    request.end()
  })
}

function fail(step, res) {
  console.error(`zitadel-seed: ${step} failed (${res.status}):`, JSON.stringify(res.json))
  process.exit(1)
}

function alreadyExists(res) {
  return (
    res.status === 409 ||
    (res.status === 400 && /already exists/i.test(JSON.stringify(res.json ?? '')))
  )
}

async function waitForPat() {
  for (let i = 0; i < 24; i++) {
    if (existsSync(PAT_FILE)) return readFileSync(PAT_FILE, 'utf8').trim()
    console.log(`zitadel-seed: waiting for PAT file ${PAT_FILE} ...`)
    await sleep(5000)
  }
  console.error(`zitadel-seed: PAT file ${PAT_FILE} never appeared — FirstInstance PatPath misconfigured?`)
  process.exit(1)
}

async function resolveOrg() {
  // `zitadel ready` (the compose healthcheck) can pass on a fresh init while the API
  // gateway still can't dial its own gRPC backend — first calls briefly 503. Retry
  // 5xx/connection errors here; once orgs/me answers, the API is fully up.
  for (let i = 0; i < 24; i++) {
    let res
    try {
      res = await api('GET', '/management/v1/orgs/me')
    } catch (err) {
      res = { status: 0, json: { message: String(err) } }
    }
    if (res.status === 200 && res.json?.org?.id) return res.json.org.id
    if (res.status >= 200 && res.status < 500) fail('orgs/me', res)
    console.log(`zitadel-seed: API not ready (orgs/me ${res.status || 'conn error'}), retrying ...`)
    await sleep(5000)
  }
  fail('orgs/me', { status: 'timeout', json: 'API never became ready after 120s' })
}

async function ensureProject() {
  const search = await api('POST', '/management/v1/projects/_search', {
    queries: [{ nameQuery: { name: PROJECT_NAME, method: 'TEXT_QUERY_METHOD_EQUALS' } }],
  })
  if (search.status === 200 && search.json?.result?.length) {
    console.log(`zitadel-seed: project '${PROJECT_NAME}' exists (${search.json.result[0].id})`)
    return search.json.result[0].id
  }
  const created = await api('POST', '/management/v1/projects', { name: PROJECT_NAME })
  if (created.status !== 200 || !created.json?.id) fail('create project', created)
  console.log(`zitadel-seed: created project '${PROJECT_NAME}' (${created.json.id})`)
  return created.json.id
}

async function ensureWebApp(projectId) {
  const search = await api('POST', `/management/v1/projects/${projectId}/apps/_search`, {
    queries: [{ nameQuery: { name: APP_NAME, method: 'TEXT_QUERY_METHOD_EQUALS' } }],
  })
  if (search.status === 200 && search.json?.result?.length) {
    const app = search.json.result[0]
    const clientId = app.oidcConfig?.clientId
    if (!clientId) fail('existing app has no oidcConfig.clientId', search)
    console.log(`zitadel-seed: app '${APP_NAME}' exists (clientId ${clientId})`)
    return clientId
  }
  const created = await api('POST', `/management/v1/projects/${projectId}/apps/oidc`, {
    name: APP_NAME,
    redirectUris: [REDIRECT_URI],
    postLogoutRedirectUris: [POST_LOGOUT_URI],
    responseTypes: ['OIDC_RESPONSE_TYPE_CODE'],
    grantTypes: ['OIDC_GRANT_TYPE_AUTHORIZATION_CODE'],
    appType: 'OIDC_APP_TYPE_WEB',
    authMethodType: 'OIDC_AUTH_METHOD_TYPE_NONE', // public client — PKCE, no secret
    accessTokenType: 'OIDC_TOKEN_TYPE_BEARER',
    devMode: true, // dev only: allows the http:// redirect URIs above
  })
  if (created.status !== 200 || !created.json?.clientId) fail('create app', created)
  console.log(`zitadel-seed: created app '${APP_NAME}' (clientId ${created.json.clientId})`)
  return created.json.clientId
}

async function ensureUser({ email, givenName, familyName }) {
  const res = await api('POST', '/v2/users/human', {
    username: email,
    organization: { orgId },
    profile: { givenName, familyName },
    email: { email, isVerified: true },
    password: { password: SEED_PASSWORD, changeRequired: false },
  })
  if (res.status === 201 || res.status === 200) {
    console.log(`zitadel-seed: created user ${email}`)
  } else if (alreadyExists(res)) {
    console.log(`zitadel-seed: user ${email} exists`)
  } else {
    fail(`create user ${email}`, res)
  }
}

pat = await waitForPat()
orgId = await resolveOrg()
console.log(`zitadel-seed: org ${orgId}`)

const projectId = await ensureProject()
const clientId = await ensureWebApp(projectId)
for (const user of SEED_USERS) await ensureUser(user)

writeFileSync(SEED_FILE, JSON.stringify({ issuer: ISSUER, clientId }, null, 2))
console.log(`zitadel-seed: wrote ${SEED_FILE} — issuer ${ISSUER}, clientId ${clientId}`)
console.log('zitadel-seed: done')
