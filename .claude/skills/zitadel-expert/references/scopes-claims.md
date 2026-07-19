# Reserved Scopes & Claims, and Getting Roles into Tokens

## Standard scopes

`openid` (mandatory), `profile`, `email`, `phone`, `address`, `offline_access` (refresh token in code flow).

## Reserved ZITADEL scopes (exact strings)

| Scope | Effect |
|---|---|
| `urn:zitadel:iam:org:id:{orgId}` | Enforce that the user is a member of this org; apply that org's branding/policies/IdPs at login |
| `urn:zitadel:iam:org:domain:primary:{domain}` | Enforce org membership by primary domain (e.g. `...primary:acme.ch`); also asserts the domain claim |
| `urn:zitadel:iam:org:project:role:{rolekey}` | Assert one specific role claim (e.g. `...role:admin`) |
| `urn:zitadel:iam:org:projects:roles` | Assert the roles claim for **each project in the token audience** |
| `urn:zitadel:iam:org:roles:id:{orgId}` | Filter the asserted roles to grants from the given org ID(s); repeatable; unknown IDs ignored |
| `urn:zitadel:iam:org:project:id:{projectId}:aud` | Add that project to the access token `aud` (needed to call APIs of another project / for introspection acceptance) |
| `urn:zitadel:iam:org:project:id:zitadel:aud` | Add the ZITADEL project itself to `aud` — **required for service accounts calling ZITADEL's own APIs** (except PATs) |
| `urn:zitadel:iam:user:metadata` | Include the user's metadata in tokens/userinfo (values base64-encoded) |
| `urn:zitadel:iam:user:resourceowner` | Include the user's org id / name / primary domain claims |
| `urn:zitadel:iam:org:idp:id:{idpId}` | Skip the login page and go straight to that external IdP |

## Reserved claims

- `urn:zitadel:iam:org:project:roles` — roles for the "current" project(s)
- `urn:zitadel:iam:org:project:{projectId}:roles` — roles scoped to a specific project id
- `urn:zitadel:iam:user:metadata` — `{"key": "<base64 value>", ...}`
- `urn:zitadel:iam:user:resourceowner:id` / `:name` / `:primary_domain` — the user's org
- `urn:zitadel:iam:org:domain:primary:{domain}` — asserted primary org domain
- `urn:zitadel:iam:action:{actionname}:log` — console.log output from Actions

### Roles claim shape (memorize this)

Nested object: role key → { org ID → org primary domain } for every org through which the user holds the role:

```json
"urn:zitadel:iam:org:project:223281986649719041:roles": {
  "cfo":    { "223281939119866113": "corporate.domain" },
  "member": { "223279178798072065": "org-a.domain" }
}
```

Parse it as `Record<roleKey, Record<orgId, orgDomain>>`. For tenant-aware authz, check both the role key *and* the org ID.

## Getting roles into tokens — the checklist

Roles are **not** included by default. You need all of:

1. **Project settings**: enable **Assert Roles on Authentication** (for userinfo/access token). Optionally **Check Role Assignment on Authentication** (deny login without a role) and **Check for Project on Authentication** (deny orgs without a grant).
2. **App settings** (OIDC token options): check **User roles inside ID Token** if you want them in the ID token itself.
3. **Request scopes**: `urn:zitadel:iam:org:projects:roles` (all audience projects) or `urn:zitadel:iam:org:project:role:{key}` (single role). Add `urn:zitadel:iam:org:project:id:{projectId}:aud` when the authenticating app is not in the same project as the API that needs the roles.

## All the ways to retrieve roles

1. **Token claims** — scopes above; decode ID token / JWT access token.
2. **UserInfo** — `GET /oidc/v1/userinfo` with the access token (needs project's Assert Roles).
3. **Introspection** — `POST /oauth/v2/introspect`; response carries the same role claims.
4. **Auth API** (acting user's own token, base `/auth/v1`):
   - `POST /auth/v1/permissions/me/_search` — roles on the requesting project
   - `POST /auth/v1/usergrants/me/_search` — all role assignments of the user
   - `POST /auth/v1/permissions/zitadel/me/_search` — the user's ZITADEL admin permissions
5. **Management API** (admin/service token, base `/management/v1`):
   - `POST /management/v1/users/grants/_search` — search role assignments (filter by user/project/org)
   - `GET /management/v1/users/{userId}/grants/{grantId}`

Terminology: docs now say **role assignment** for what the APIs still call *user grant* / *authorization* — same thing.
