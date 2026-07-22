// zitadel-seed — idempotent dev seeding of the ZITADEL instance (stage 1 of
// .claude/specs/future-auth/zitadel-login-pattern.md).
//
// Runs once per `docker compose up` (after the zitadel healthcheck), authenticated
// with the FirstInstance machine-user PAT that ZITADEL writes onto the shared
// volume. Ensures:
//   1. project `fnb`
//   2. Web app `fnb-web` — auth method NONE (PKCE), Dev Mode on, redirect/post-logout
//      URIs pointing at the Caddy entry point on ${APP_PORT}
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
const PAT_FILE = requiredEnv('PAT_FILE') // written by ZITADEL FirstInstance PatPath
const SEED_FILE = requiredEnv('SEED_FILE') // { issuer, clientId } handoff for auth-app
const BRAND_ASSETS_DIR = process.env.BRAND_ASSETS_DIR ?? '/brand-assets' // mounted handoff logos/icons (plan 0500)

// SEED_MODE=prod (deployment spec .claude/specs/deployment/production-runtime.md §6): register the
// app against the https origin with devMode OFF and seed NO dev users — the console admin comes from
// ZITADEL FirstInstance, and password complexity is left at ZITADEL defaults by NOT relaxing it in
// the prod compose. Unset (or anything else) = the dev behavior below, byte-for-byte.
const SEED_MODE = process.env.ZITADEL_SEED_MODE ?? 'dev'
const IS_PROD = SEED_MODE === 'prod'

// first-run-setup: SEED_DATA=empty stands up a virgin env — project/app/branding are still
// seeded (auth-app needs the clientId handoff), but NO user roster, so the /auth/setup flow
// mints the first user. Folds into the same "skip roster" branch as prod, while staying on the
// dev origin/devMode.
const SEED_USERS_ENABLED = (process.env.SEED_DATA ?? 'full') !== 'empty' && !IS_PROD

// Dev embeds the Caddy host port; prod uses the public https origin (APP_ORIGIN=https://<domain>,
// terminated by Caddy). APP_PORT stays required in dev only.
const APP_ORIGIN = IS_PROD
  ? requiredEnv('APP_ORIGIN')
  : `http://localhost:${requiredEnv('APP_PORT')}`

const PROJECT_NAME = 'fnb'
const APP_NAME = 'fnb-web'
const REDIRECT_URI = `${APP_ORIGIN}/auth/api/auth/oidc/callback`
const POST_LOGOUT_URI = `${APP_ORIGIN}/`

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
    devMode: !IS_PROD, // dev: allows the http:// redirect URIs above; prod: OFF (https origin)
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

// ── Branding (plan 0500) ───────────────────────────────────────────────────
// Apply the fnb brand mark to ZITADEL's hosted login. We target the INSTANCE
// label policy (admin API + instance asset endpoints), not the org policy,
// because our OIDC authorize requests are NOT org-scoped — the hosted login
// therefore renders the instance default branding. This needs the seed PAT to
// hold IAM_OWNER, which the FirstInstance machine user is granted at setup.
//   Fallback if these 403: the PAT lacks IAM_OWNER — either grant it, or switch
//   to the org label policy (/management/v1/policies/label, already org-scoped
//   via x-zitadel-orgid) AND org-scope the authorize request in
//   apps/auth-app/server/utils/oidc.ts (scope += ' urn:zitadel:iam:org:id:'+orgId).
// Colors/logos/mapping come from the brand handoff (design_handoff_fn_bucket_brand).
const BRAND = {
  primaryColor: '#156f41', // green-600 prompt glyph
  primaryColorDark: '#50986b', // green-400 (prompt glyph on dark)
  backgroundColor: '#f0f4f7',
  backgroundColorDark: '#0e1216',
  fontColor: '#1b2025',
  fontColorDark: '#eceff2',
  disableWatermark: true,
  hideLoginNameSuffix: true,
  themeMode: 'THEME_MODE_AUTO', // follow the visitor's system light/dark
}

// Like api(), but WITHOUT the x-zitadel-orgid header — instance/admin + assets
// endpoints are instance-scoped. Same Host-header + Bearer transport (node:http).
function instanceRequest(method, path, { headers = {}, body } = {}) {
  const url = new URL(path, BASE)
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: { host: HOST_HEADER, authorization: `Bearer ${pat}`, ...headers },
      },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let json = null
          try {
            json = raw ? JSON.parse(raw) : null
          } catch {
            json = { raw }
          }
          resolve({ status: res.statusCode ?? 0, json })
        })
      },
    )
    request.on('error', reject)
    if (body) request.write(body)
    request.end()
  })
}

function jsonBody(obj) {
  const payload = JSON.stringify(obj)
  return {
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
    body: payload,
  }
}

async function uploadAsset(path, fileName, contentType) {
  const filePath = `${BRAND_ASSETS_DIR}/${fileName}`
  if (!existsSync(filePath)) {
    fail(`branding asset ${filePath}`, { status: 0, json: 'not found — is the assets dir mounted?' })
  }
  const file = readFileSync(filePath)
  const boundary = `----fnbBrand${Date.now().toString(16)}`
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([head, file, tail])
  const res = await instanceRequest('POST', path, {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': body.length },
    body,
  })
  if (res.status < 200 || res.status >= 300) fail(`upload ${fileName}`, res)
  console.log(`zitadel-seed: uploaded ${fileName} → ${path}`)
}

async function ensureBranding() {
  // Merge onto the current policy so we never blank fields we don't set (warn colors, etc.).
  const current = await instanceRequest('GET', '/admin/v1/policies/label')
  if (current.status < 200 || current.status >= 300) fail('get label policy', current)
  const merged = { ...(current.json?.policy ?? {}), ...BRAND }
  const update = {
    primaryColor: merged.primaryColor,
    hideLoginNameSuffix: merged.hideLoginNameSuffix,
    warnColor: merged.warnColor,
    backgroundColor: merged.backgroundColor,
    fontColor: merged.fontColor,
    primaryColorDark: merged.primaryColorDark,
    backgroundColorDark: merged.backgroundColorDark,
    warnColorDark: merged.warnColorDark,
    fontColorDark: merged.fontColorDark,
    disableWatermark: merged.disableWatermark,
    themeMode: merged.themeMode,
  }
  const put = await instanceRequest('PUT', '/admin/v1/policies/label', jsonBody(update))
  if (put.status < 200 || put.status >= 300) fail('update label policy', put)
  console.log('zitadel-seed: label policy colors updated')

  // Per-theme logo (login card) + icon (console/compact). Handoff mapping.
  await uploadAsset('/assets/v1/instance/policy/label/logo', 'logo-light.png', 'image/png')
  await uploadAsset('/assets/v1/instance/policy/label/logo/dark', 'logo-dark.png', 'image/png')
  await uploadAsset('/assets/v1/instance/policy/label/icon', 'icon-light-512.png', 'image/png')
  await uploadAsset('/assets/v1/instance/policy/label/icon/dark', 'icon-512.png', 'image/png')

  // Promote the edited preview policy to active (colors + freshly uploaded assets).
  const activate = await instanceRequest('POST', '/admin/v1/policies/label/_activate', jsonBody({}))
  if (activate.status < 200 || activate.status >= 300) fail('activate label policy', activate)
  console.log('zitadel-seed: label policy activated')
}

pat = await waitForPat()
orgId = await resolveOrg()
console.log(`zitadel-seed: org ${orgId}`)

const projectId = await ensureProject()
const clientId = await ensureWebApp(projectId)
if (!SEED_USERS_ENABLED) {
  const reason = IS_PROD
    ? 'prod mode (admin comes from FirstInstance)'
    : 'SEED_DATA=empty (first user comes from /auth/setup)'
  console.log(`zitadel-seed: skipping dev user seeding — ${reason}`)
} else {
  for (const user of SEED_USERS) await ensureUser(user)
}

// Instance branding (plan 0500) — runs in dev AND prod (not a dev-only seed step).
await ensureBranding()

writeFileSync(SEED_FILE, JSON.stringify({ issuer: ISSUER, clientId }, null, 2))
console.log(`zitadel-seed: wrote ${SEED_FILE} — issuer ${ISSUER}, clientId ${clientId}`)
console.log('zitadel-seed: done')
