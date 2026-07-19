# OIDC / OAuth2 — Endpoints, Flows, Grant Types

All endpoints live on the instance domain (`${CUSTOM_DOMAIN}` = `https://<instance>.zitadel.cloud` or your self-hosted `ExternalDomain`). Always start from discovery.

## Endpoints

| Endpoint | URL |
|---|---|
| Discovery | `${CUSTOM_DOMAIN}/.well-known/openid-configuration` |
| Authorization | `${CUSTOM_DOMAIN}/oauth/v2/authorize` |
| Token | `${CUSTOM_DOMAIN}/oauth/v2/token` |
| Introspection | `${CUSTOM_DOMAIN}/oauth/v2/introspect` |
| UserInfo | `${CUSTOM_DOMAIN}/oidc/v1/userinfo` |
| Revocation | `${CUSTOM_DOMAIN}/oauth/v2/revoke` |
| End session (logout) | `${CUSTOM_DOMAIN}/oidc/v1/end_session` |
| JWKS | `${CUSTOM_DOMAIN}/oauth/v2/keys` |

Keys at the JWKS endpoint rotate automatically without notice — cache with refresh, never pin.

## Grant types

Supported: **authorization code**, **authorization code + PKCE** (recommended default for anything with a user), **client credentials**, **refresh token**, **JWT profile** (`urn:ietf:params:oauth:grant-type:jwt-bearer`, service accounts), **token exchange** (RFC 8693, incl. impersonation), **device authorization**, implicit (legacy only).

Not supported: **Resource Owner Password Credentials** ("due to growing security concerns"), SAML 2.0 bearer.

## Authorization code + PKCE (web/SPA/native)

1. Generate a random `code_verifier`; `code_challenge = base64url(sha256(verifier))`.
2. Redirect the browser to:

```
GET /oauth/v2/authorize
  ?client_id={CLIENT_ID}
  &redirect_uri={REGISTERED_URI}          # exact match required
  &response_type=code
  &scope=openid profile email             # add reserved scopes as needed
  &code_challenge={CHALLENGE}
  &code_challenge_method=S256
  &state={random}                         # recommended
  &nonce={random}                         # recommended
```

Optional: `prompt` (`login`, `select_account`, `create` …), `login_hint`, `id_token_hint`, `max_age`, `ui_locales`, `response_mode`.

3. Callback receives `?code=...&state=...`. Exchange it:

```
POST /oauth/v2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={code}
&redirect_uri={same as before}
&client_id={CLIENT_ID}
&code_verifier={original verifier}
```

(Confidential web apps using client-secret auth send `client_id`/`client_secret` via basic auth or body instead of `code_verifier`; private-key-JWT apps send a `client_assertion`.)

4. Response: `access_token` (opaque Bearer by default — switchable to JWT in app token settings), `id_token`, `expires_in`, and `refresh_token` **only if** the `offline_access` scope was requested *and* refresh tokens are enabled on the app.

## Refresh

```
POST /oauth/v2/token
grant_type=refresh_token&refresh_token={token}&client_id={CLIENT_ID}
```

## Logout (RP-initiated)

```
GET /oidc/v1/end_session
  ?id_token_hint={id_token}
  &post_logout_redirect_uri=https://app.example.com/logged_out
  &state={random}
```

- `post_logout_redirect_uri` must be pre-registered on the app; when used, you **must** send `id_token_hint` **or** `client_id` so ZITADEL can validate the URI.
- Sessions are tracked server-side per user agent (browser cookie holds all open sessions for that browser).
- Revoke tokens explicitly at `/oauth/v2/revoke`; revoking a refresh token also revokes its access tokens.

## UserInfo

`GET /oidc/v1/userinfo` with `Authorization: Bearer {access_token}` — returns claims per granted scopes; includes roles/metadata if the project/app settings and scopes call for them (see scopes-claims.md).

## App-type → flow cheat sheet

- **SSR web app (e.g. Nuxt)** → Web app, code + PKCE (public) or + client secret/private key JWT (confidential). Session lives in your app; refresh with `offline_access`.
- **SPA** → User Agent app, code + PKCE, no secret.
- **Mobile/desktop** → Native, code + PKCE, custom-scheme redirect allowed.
- **Machine → machine** → service account, JWT profile or client credentials (see service-users-and-apis.md) — *not* an authorize redirect.
- **Your API validating calls** → API app registration + introspection, or JWT tokens + JWKS (see service-users-and-apis.md).
