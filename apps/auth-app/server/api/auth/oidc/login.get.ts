// GET /api/auth/oidc/login
//
// Starts the ZITADEL hosted-login ceremony: generates PKCE verifier + state, parks them in
// short-lived httpOnly cookies, and 302s the browser to the external authorize endpoint.
// The callback (callback.get.ts) completes the exchange.

import * as oidc from 'openid-client'

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

  const authorizeUrl = oidc.buildAuthorizationUrl(config, {
    redirect_uri: `${pub.authAppUrl}/api/auth/oidc/callback`,
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })

  return sendRedirect(event, authorizeUrl.href, 302)
})
