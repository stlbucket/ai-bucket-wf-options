---
name: zitadel-expert
description: Expert in ZITADEL, the open-source identity and access management platform (IdP). Use this skill for any task involving ZITADEL — integrating OIDC/OAuth login into an app, configuring applications/projects/organizations, retrieving user roles from tokens, authenticating service accounts (private key JWT, client credentials, personal access tokens), calling the ZITADEL management/v2 APIs, validating tokens in an API backend (introspection vs JWKS), building a custom login UI with the Session API, Actions (v1 flows or v2 targets/executions), multi-tenant B2B setups (orgs, project grants, delegated admin), or self-hosting (Docker Compose, config/env vars, masterkey, FirstInstance seeding, reverse proxy, production checklist). Trigger this even when the user names it loosely ("our IdP", "the auth server", "zitadel org/project/grant", "urn:zitadel scopes") — ZITADEL has specific reserved scopes, claim formats, API paths, and config keys that are easy to get wrong from memory.
---

# ZITADEL Expert

ZITADEL is an open-source, multi-tenant identity provider (Go backend, event-sourced on PostgreSQL) that speaks OIDC/OAuth2 and SAML, ships a hosted login UI and a management Console, and exposes everything through gRPC/REST APIs. It is self-hostable (Docker) or available as ZITADEL Cloud; either way one domain serves as the OIDC issuer *and* the base URL for all APIs.

## Core mental model

The resource hierarchy, top-down:

- **Instance** — the whole deployment (one issuer domain). Holds default settings (branding, login/password policies). Multiple *virtual* instances are possible via the System API.
- **Organization** — the tenant. "The vessel where your projects and users live." Users and data in one org are isolated from others; each org can override instance settings (branding, IdPs, MFA, lockout). One verified domain is the **primary org domain** and shapes login names (`user@primary.domain`) and `preferred_username`.
- **Project** — the security context for one software solution. Contains **applications** (clients sharing the same roles) and **roles** (key + display name + group). A project can be **granted** to another organization (B2B) with a restricted role subset.
- **Application** — one client inside a project. Five types: **Web** (SSR; code+PKCE recommended, or client secret / private key JWT), **Native** (PKCE only), **User Agent** (SPA; PKCE), **API** (no user; private key JWT or basic auth — this is the resource-server registration used for introspection), **SAML**.
- **User** — belongs to exactly **one** org, never transferable. **Human** (interactive: password, MFA, passkeys, federated via external IdPs) or **service account / machine user** (non-interactive: private key JWT, client secret, or personal access token). Key–value **metadata** on users can be asserted into tokens.
- **Role assignment** (formerly *user grant / authorization*) — user × project × role(s). This is app-level RBAC, distinct from **manager roles** (ZITADEL-administration RBAC like `IAM_OWNER`, `ORG_OWNER`, `PROJECT_OWNER`).

Multi-tenancy pattern: one org per customer/tenant; your product lives in *your* org's project; grant the project to customer orgs; their `ORG_OWNER`s self-manage users and role assignments within the roles you allowed.

## Decision guide — which reference to read

Read the relevant reference before writing code or config; they carry the exact URLs, scope strings, claim formats, and YAML keys.

- **Hierarchy: instance/org/project/app/user, manager roles (full list), B2B project grants, delegated admin** → `references/concepts.md`
- **OIDC endpoints, authorize/token/logout flows, PKCE, grant types, app auth methods** → `references/oidc-flows.md`
- **Reserved `urn:zitadel:iam:...` scopes and claims, the roles-claim JSON shape, how to get roles into tokens (project settings + scopes), all ways to retrieve roles** → `references/scopes-claims.md`
- **API surface (v1 vs v2 paths), authenticating service accounts (private key JWT / client credentials / PAT), the `zitadel:aud` audience scope, validating tokens in your API (introspection vs JWKS)** → `references/service-users-and-apis.md`
- **Custom login UI via Session API, hosted login v1 vs v2, logout/session termination** → `references/login-and-sessions.md`
- **Actions: v1 script flows (complement token etc.) and v2 targets/executions** → `references/actions.md`
- **Self-hosting: Docker Compose, config YAML ↔ env-var mapping, masterkey, FirstInstance seeding (admin human + machine PAT), TLS modes / reverse proxy (h2c!), production checklist** → `references/self-hosting.md`

## High-value rules that prevent real bugs

1. **Roles don't appear in tokens by default.** You need the project's "Assert Roles on Authentication" setting (and/or the app's "User Roles Inside ID Token") *plus* the right scope (`urn:zitadel:iam:org:projects:roles` or a per-project variant). The claim is a nested object keyed by role, then by org ID → org domain — not a flat array.
2. **Service accounts calling ZITADEL's own APIs need the audience scope** `urn:zitadel:iam:org:project:id:zitadel:aud` (PATs are exempt — they're ready-made Bearer tokens). Without it you get 401s with valid-looking tokens.
3. **Access tokens are opaque by default** (Bearer type). Your API either introspects them (works for both opaque and JWT) or you switch the app's token type to JWT and validate locally against `/oauth/v2/keys`. Don't assume you can decode the default token.
4. **The management API is org-scoped via the `x-zitadel-orgid` header** — omit it and you operate on the token's default org, a classic silent-wrong-tenant bug.
5. **Users live in exactly one org.** Cross-org access is modeled with project grants + role assignments, never by moving/duplicating users. Same email may exist in different orgs as different users.
6. **Prefer v2 resource APIs** (`/v2/...`: user, session, org, settings…) for new work; v1 (`/management/v1`, `/auth/v1`, `/admin/v1`) is maintained but frozen. The Session API (custom login) is v2-only.
7. **Redirect URIs are exact-match** and HTTPS-only unless the app has Dev Mode on. Post-logout redirect URIs must also be pre-registered, and the end_session call then needs `id_token_hint` or `client_id`.
8. **Self-hosting: the masterkey (exactly 32 chars) cannot be changed** after init without losing encrypted data, and any reverse proxy in front must forward **h2c (HTTP/2 cleartext)** with the original `Host` header — HTTP/1.1 upstream breaks gRPC, wrong Host breaks the issuer.
9. **Scope an auth request to a tenant** with `urn:zitadel:iam:org:id:{id}` (or `org:domain:primary:{domain}`) to enforce org membership and get that org's branding/IdPs; otherwise the default org's discovery applies.
10. **Resource Owner Password Credentials is not supported** — don't design around it. Use code+PKCE for anything with a user, JWT profile / client credentials for machines.

## Versioning note

ZITADEL moves fast: login v2 (self-hostable Next.js login), Actions v2 (HTTP targets/executions replacing v1 scripts), and the v2 resource APIs all coexist with their v1 counterparts. When behavior seems off or a console screen doesn't match these notes, check the running version and consult https://zitadel.com/docs — API reference at https://zitadel.com/docs/apis/introduction, source at https://github.com/zitadel/zitadel.
