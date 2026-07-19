// GET /api/auth/oidc/logout
//
// RP-initiated logout: clears the app session cookies (idempotent — the client's POST
// /api/auth/logout normally already did), then 302s to ZITADEL's end_session so the SSO
// session dies too. Uses the client_id variant (we do not retain the id_token) with the
// registered post-logout redirect back to the stack's home page.

export default defineEventHandler(async (event) => {
  const { issuer, clientId } = await getOidcContext()
  const { public: pub } = useRuntimeConfig(event)

  await deleteAuthCookies(event)

  const endSession = new URL(`${issuer}/oidc/v1/end_session`)
  endSession.searchParams.set('client_id', clientId)
  endSession.searchParams.set('post_logout_redirect_uri', `${new URL(pub.authAppUrl as string).origin}/`)

  return sendRedirect(event, endSession.href, 302)
})
