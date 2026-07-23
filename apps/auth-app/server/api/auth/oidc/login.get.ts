// GET /api/auth/oidc/login
//
// Starts the ZITADEL hosted-login ceremony: generates PKCE verifier + state, parks them in
// short-lived httpOnly cookies, and 302s the browser to the external authorize endpoint.
// The callback (callback.get.ts) completes the exchange.

import * as oidc from 'openid-client'
import { isSafeReturnTo } from '@function-bucket/fnb-types'

const TXN_COOKIE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: true, // localhost is exempt in browsers — works in the dev stack
  maxAge: 60 * 10,
}

export default defineEventHandler(async (event) => {
  const { config } = await getOidcContext()
  const { public: pub } = useRuntimeConfig(event)

  const codeVerifier = oidc.randomPKCECodeVerifier()
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier)
  const state = oidc.randomState()

  setCookie(event, 'oidc_verifier', codeVerifier, TXN_COOKIE)
  setCookie(event, 'oidc_state', state, TXN_COOKIE)

  // Optional return-to (auth-app/login.data.md §Return-to): park a validated root-relative path in
  // a short-lived httpOnly cookie so the callback can land the user back where they started (the
  // deep-link "Sign in with ZITADEL" case) instead of home. Fail-closed: anything not root-relative
  // is dropped here and again on consume.
  const returnTo = getQuery(event).returnTo
  if (isSafeReturnTo(returnTo)) {
    setCookie(event, 'oidc_return_to', returnTo, TXN_COOKIE)
  }

  const authorizeUrl = oidc.buildAuthorizationUrl(config, {
    redirect_uri: `${pub.authAppUrl}/api/auth/oidc/callback`,
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })

  return sendRedirect(event, authorizeUrl.href, 302)
})
