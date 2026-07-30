# Login Options — Hosted Login v1/v2, Custom Login via Session API

## Hosted login v1 (built-in)

The classic redirect target of `/oauth/v2/authorize`. Fully managed, complete feature set: username/password, social/enterprise IdPs (Okta, Entra ID, LDAP, Google…), MFA (OTP, TOTP, SMS, email, U2F), passkeys, account picker, self-service (password reset, MFA/passkey enrollment). Branding (logo/colors/texts) per instance and per org; custom login texts via Settings API. Multi-tenant: org-scoped auth requests get the org's branding, policies, and IdPs.

## Hosted login v2 (Next.js, self-hostable)

MIT-licensed Next.js app (github.com/zitadel/typescript) built on the **Session and User v2 APIs**; fork/customize anything, deploy yourself (Vercel button or your infra).

Enabling:
- **Per app**: enable Login V2 in app settings; empty custom URL → default path `/ui/v2/login`.
- **Per instance**: `loginV2` feature flag for all apps.
- **Custom domain**: deploy it yourself, add the domain to Trusted Domains.

Prerequisites for a self-run login v2: a service account with a PAT and the `IAM_LOGIN_CLIENT` manager role (the role purpose-built for custom login UIs).

Known v2 gaps (check current docs — this list shrinks): generic JWT IdP, LDAP IdP, device authorization grant, force-MFA for externally authenticated users, custom login texts editable only via Settings v2 API. **Passkeys are domain-bound**: moving login to a different domain strands existing passkeys unless the new login is a subdomain of the old one.

Choose v1 for zero maintenance; v2 when you need deep customization or your-domain hosting.

## Custom login UI with the Session API (v2)

Build any login experience; the Session API replaces the hosted page entirely. Your login backend authenticates with the login-client service account (PAT + `IAM_LOGIN_CLIENT`).

### Create a session (identify the user)

```
POST ${CUSTOM_DOMAIN}/v2/sessions
{ "checks": { "user": { "loginName": "minnie-mouse@fabi.zitadel.app" } } }
```

→ `{ "sessionId": "2184...", "sessionToken": "yMDi6..." , "details": {...} }`

### Add checks (e.g. password)

```
PATCH ${CUSTOM_DOMAIN}/v2/sessions/{sessionId}
{ "checks": { "password": { "password": "Secr3tP4ssw0rd!" } } }
```

→ new `sessionToken`; the session's `factors` now carry verification timestamps (`user.verifiedAt`, `password.verifiedAt`). Further checks exist for IdP intents, TOTP/OTP, WebAuthn/passkeys — same PATCH pattern.

### Validate / terminate

- Session validity = inspect `factors` (+ optional lifetime you set).
- `DELETE /v2/sessions/{sessionId}` terminates (needs the session token or `session.delete` permission).

### Finishing an OIDC flow with a session

When your app is set to use your custom login, ZITADEL redirects to your login UI with an `authRequest` id. Authenticate via the Session API, then finalize with the OIDC service (`/v2/oidc/auth_requests/{authRequestId}` — link the session or fail the request) which returns the callback URL to redirect the browser to. Guides: `zitadel.com/docs/guides/integrate/login-ui/*` (username-password, external-login, passkey, mfa, oidc-standard, saml-standard, logout).

## Which to pick

- Default: **hosted login v1** — least work, full features, org-scoped branding covers most multi-tenant needs.
- Brand-critical or flow-critical UX on your own domain: **login v2** (fork) — still standard OIDC outside.
- Fully bespoke (native flows, embedded login, non-standard steps): **Session API custom UI** — most work; you own security-sensitive surface (lockout, MFA ordering, bot protection).
