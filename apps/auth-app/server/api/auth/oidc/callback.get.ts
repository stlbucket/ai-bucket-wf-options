// GET /api/auth/oidc/callback?code=...&state=...
//
// Completes the ZITADEL login ceremony: state check, PKCE code exchange (via the internal
// URL override — see server/utils/oidc.ts), id_token verification (openid-client handles
// JWKS/iss/aud), email_verified gate, then provisionIdpUser + createSession (db-access
// pre-claims root of trust) and the sealed httpOnly session cookie { id, sid }. This is the
// ONLY place the cookie is written — validity lives in the auth.session row and renewal is a
// server-side touch (session-refresh-pattern.md), never a re-seal.
//
// Redirects to the login page with ?oidc=success — it owns post-login claims hydration and
// the residency-selection flow (same as password login's onLoginSuccess path).

import * as oidc from 'openid-client'
import { provisionIdpUser, createSession } from '@function-bucket/fnb-db-access'
import { isSafeReturnTo } from '@function-bucket/fnb-types'

export default defineEventHandler(async (event) => {
  const { config } = await getOidcContext()
  const { public: pub } = useRuntimeConfig(event)
  const query = getQuery(event)

  if (query.error) {
    throw createError({ statusCode: 401, message: `OIDC error: ${String(query.error)}` })
  }
  if (!query.code || !query.state) {
    throw createError({ statusCode: 400, message: 'Missing code/state' })
  }

  const codeVerifier = getCookie(event, 'oidc_verifier')
  const expectedState = getCookie(event, 'oidc_state')
  const returnTo = getCookie(event, 'oidc_return_to')
  deleteCookie(event, 'oidc_verifier')
  deleteCookie(event, 'oidc_state')
  deleteCookie(event, 'oidc_return_to')
  if (!codeVerifier || !expectedState) {
    throw createError({ statusCode: 401, message: 'Missing or expired OIDC transaction cookies' })
  }

  // Reconstruct the redirect URL deterministically from config (not from proxy-dependent
  // request headers) — openid-client derives the token request's redirect_uri from it.
  const currentUrl = new URL(`${pub.authAppUrl}/api/auth/oidc/callback`)
  currentUrl.searchParams.set('code', String(query.code))
  currentUrl.searchParams.set('state', String(query.state))

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState,
    })
  } catch (err) {
    console.error('oidc callback: code exchange failed', err)
    throw createError({ statusCode: 401, message: 'OIDC code exchange failed' })
  }

  const idClaims = tokens.claims()
  if (!idClaims?.sub) {
    throw createError({ statusCode: 401, message: 'OIDC token has no subject' })
  }

  // email/email_verified/name come from userinfo (robust regardless of the app's
  // "userinfo inside id_token" assertion setting).
  const info = await oidc.fetchUserInfo(config, tokens.access_token, idClaims.sub)

  // Provisioning links profiles by email, so an unverified email must never mint a session.
  if (info.email_verified !== true || !info.email) {
    throw createError({ statusCode: 401, message: 'Email not verified' })
  }

  const profile = await provisionIdpUser(idClaims.sub, info.email, (info.name as string | undefined) ?? null)
  const sid = await createSession(profile.id)

  await deleteAuthCookies(event) // legacy auth.user cleanup; session is re-set below
  await setAppSession(event, { id: profile.id, sid })

  // Land on /login?oidc=success — it owns claims hydration + residency selection. When a validated
  // return-to rode along (auth-app/login.data.md §Return-to), re-emit it as a query so /login
  // forwards there after the residency flow instead of home. Re-checked fail-closed.
  const successUrl = new URL(`${pub.authAppUrl}/login`)
  successUrl.searchParams.set('oidc', 'success')
  if (isSafeReturnTo(returnTo)) {
    successUrl.searchParams.set('returnTo', returnTo)
  }
  return sendRedirect(event, successUrl.href, 302)
})
