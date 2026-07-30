# Service Accounts, ZITADEL APIs, and Token Validation

## API surface

One domain serves everything (issuer + Console + APIs). All APIs are gRPC-first with REST/connect mappings.

**v2 resource APIs — use for new work.** REST base `/v2/`; gRPC services like `/zitadel.user.v2.UserService/`. Cover: User, Session, Organization, Instance, Project, Application, IdP, Settings, Features, Authorization, Action, WebKey, OIDC, SAML.

**v1 legacy APIs — maintained, not extended:**

| Service | REST base | gRPC |
|---|---|---|
| Auth (acting user, "me") | `/auth/v1/` | `/zitadel.auth.v1.AuthService/` |
| Management (org-scoped admin) | `/management/v1/` | `/zitadel.management.v1.ManagementService/` |
| Admin (instance) | `/admin/v1/` | `/zitadel.admin.v1.AdminService/` |
| System (multi-instance, self-hosted only, own auth) | `/system/v1/` | `/zitadel.system.v1.SystemService/` |
| Assets (upload/serve files) | `/assets/v1/` | — |

**`x-zitadel-orgid` header** sets the target organization on Management API calls; without it, the token's default org context is used. Forgetting it is the classic wrong-tenant bug.

The caller needs appropriate **manager roles** (e.g. `ORG_OWNER` for org management, `IAM_OWNER` for instance) — see concepts.md.

## Service accounts (machine users)

Three auth methods; all are users in an org, given manager roles as needed.

### 1. Private key JWT (JWT profile) — most secure, preferred

Generate a key on the service user (Console → Service Accounts → Keys). Download JSON:

```json
{
  "type": "serviceaccount",
  "keyId": "100509901696068329",
  "key": "-----BEGIN RSA PRIVATE KEY-----...-----END RSA PRIVATE KEY-----\n",
  "userId": "100507859606888466"
}
```

Build and sign a JWT — header `{"alg":"RS256","kid":"<keyId>"}`, payload:

```json
{
  "iss": "<userId>",
  "sub": "<userId>",
  "aud": "https://<CUSTOM_DOMAIN>",
  "iat": <now>,            // not older than 1h
  "exp": <now + 1h>
}
```

Exchange it:

```bash
curl -X POST https://${CUSTOM_DOMAIN}/oauth/v2/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer \
  --data scope='openid urn:zitadel:iam:org:project:id:zitadel:aud' \
  --data assertion=eyJ0eXAiOiJKV1QiL...
```

Response: `{"access_token": "...", "token_type": "Bearer", "expires_in": 43199}`.

### 2. Client credentials

Console → service user → Actions → **Generate Client Secret** (shown once).

```bash
curl -X POST https://${CUSTOM_DOMAIN}/oauth/v2/token \
  --user "$CLIENT_ID:$CLIENT_SECRET" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data grant_type=client_credentials \
  --data scope='openid urn:zitadel:iam:org:project:id:zitadel:aud'
```

### 3. Personal access token (PAT)

Ready-made Bearer token, service accounts only. Created on the user with optional expiry; shown once. No token endpoint round-trip and **no audience scope needed**:

```bash
curl https://${CUSTOM_DOMAIN}/management/v1/orgs/me \
  -H 'Authorization: Bearer {PAT}'
```

### The audience rule

For JWT-profile and client-credentials tokens to be accepted by ZITADEL's own APIs, the token request **must** include the scope `urn:zitadel:iam:org:project:id:zitadel:aud`. To be accepted by *your* API's introspection, include `urn:zitadel:iam:org:project:id:{yourProjectId}:aud` (automatic when the client app is in that project).

## Validating tokens in your API backend

Register your backend as an **API application** (auth: private key JWT or basic) in the same project as the client apps.

**Option A — Introspection (works for opaque *and* JWT tokens; real-time revocation):**

```bash
curl -X POST https://${CUSTOM_DOMAIN}/oauth/v2/introspect \
  --user "$API_CLIENT_ID:$API_CLIENT_SECRET" \   # or client_assertion with private key JWT (recommended)
  --data token=$ACCESS_TOKEN
```

Response has `active: true/false` plus the token's claims (including role claims when asserted). Treat `active: false` as 401.

**Option B — Local JWT validation:** switch the client app's access-token type to **JWT**, then verify signature against `${CUSTOM_DOMAIN}/oauth/v2/keys` (kid-based, keys rotate), check `iss`, `exp`, and that your project/client is in `aud`. Faster (no network hop per request) but no revocation awareness.

Rule of thumb: introspect at the edge or for sensitive operations; JWKS-validate for high-throughput internal checks — and remember the default token type is opaque, so Option B requires the app-config change.
