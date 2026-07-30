# ZITADEL Concepts — Hierarchy, Managers, B2B

## Instance

Top node of the data hierarchy ("Instance" replaced the older term "IAM"). One instance = one tenant environment on one domain that acts as the identity issuer (e.g. `login.customer.com`). Contains many organizations. Instance-level **default settings** cover branding, login policy, password policy, lockout, message texts, languages — orgs inherit and may override them. Additional *virtual instances* can be created through the System API (self-hosted / cloud multi-instance scenarios).

## Organization

- "The vessel where your projects and users live" — the tenant unit. Users and data of one org are isolated from other orgs.
- **Domains**: an org can have multiple domains; exactly one is the **Organization Domain (primary)**. It determines the displayed login name and the `preferred_username` asserted in tokens. Custom domains (e.g. `acme.ch`) must be verified via DNS or HTTP challenge (verification can be disabled on self-hosted instances). Usernames must be unique *within* the org; the same email can exist in different orgs.
- **Domain discovery**: with no org selected in the auth request, users land on the instance's **default organization** for login/registration.
- **Per-org overrides**: login behavior (MFA, passwordless, session lifetimes), org-specific identity providers, password complexity, lockout, branding, message texts/i18n, external links (ToS/privacy/support).
- To force org context in an auth request use the reserved scope `urn:zitadel:iam:org:id:{id}` (see scopes-claims.md).

## Project

"A vessel for all components who are closely related to each other" — defines the security context of one software solution.

- **Applications** in a project share the same roles and security context.
- **Roles** = `key` (identifier used in code) + `display name` + `group` (console organization only). Defined once per project, shared by all its apps.
- **Project settings**:
  - *Branding*: Unspecified (system default) / Enforce project's policy / Allow login user policy (switch to user's org branding after identification).
  - **Assert Roles on Authentication** — role data is put on userinfo/tokens.
  - **Check Role Assignment on Authentication** — user must have ≥1 role on the project to log in at all.
  - **Check for Project on Authentication** — user's org must have a grant/access to the project.

### Project grants (B2B)

A **project grant** lets another organization use your project. The granted org manages role assignments for *their own* users, restricted to the **subset of roles** you included in the grant (e.g. grant only `reader`/`writer`, keep `admin` internal). This is the core B2B delegation mechanism: customers self-administer inside their org without touching yours.

## Applications

Five types; auth methods differ per type:

| Type | For | Auth methods |
|---|---|---|
| **Web** | Server-side rendered apps (Nuxt SSR, Django, Spring…) | Code + **PKCE** (recommended), code + client secret (basic/post), private key JWT |
| **Native** | Mobile/desktop | PKCE only (custom-protocol redirect URIs like `myapp://` allowed) |
| **User Agent** | SPAs running fully in browser | PKCE (implicit is legacy) |
| **API** | Resource servers / no human | Private key JWT or basic auth — this registration is what lets your backend call introspection |
| **SAML** | SAML SPs | Metadata file/XML upload |

- **Redirect URIs**: strictly exact-matched. **Dev Mode** relaxes to allow http:// and glob patterns for local work.
- **Token settings** per app: token type **Bearer (opaque, default) vs JWT**; "User roles inside ID Token"; "User Info inside ID Token"; clock-skew allowance.
- CORS: additional origins configurable on the app.

## Users

- **Human users**: email, password, optional profile (phone, nickname, gender, language). Authenticate via password, MFA (OTP/TOTP/SMS/email/U2F), or passkeys.
- **Service accounts / machine users**: non-interactive; authenticate with private key JWT, client secret, or PAT (see service-users-and-apis.md).
- **Federated users**: from external IdPs (Google, Entra ID, GitHub…), linked to a ZITADEL account for role assignment and audit.
- A user belongs to **exactly one org** and cannot be moved. Identify a user by `id` or by `loginname` + org domain (`road.runner@acme.zitadel.local`).
- **Metadata**: key–value store per user (Auth/Management APIs); expose via userinfo or into tokens with scope `urn:zitadel:iam:user:metadata` (values base64-encoded).
- **Role assignment** (docs' current term; APIs still say *user grant* / *authorization*): user × project (or granted project) × roles.

## Managers (ZITADEL-administration RBAC)

Distinct from project roles. Set on the resource's detail page ("Administrators" panel in Console) at four levels. Exact role names:

**Instance level**
- `IAM_OWNER` — manage the instance and all orgs with their content
- `IAM_OWNER_VIEWER` — view all of the above
- `IAM_ORG_MANAGER` — manage all orgs incl. policies, projects, users
- `IAM_USER_MANAGER` — manage all users + their authorizations across orgs
- `IAM_ADMIN_IMPERSONATOR` / `IAM_END_USER_IMPERSONATOR` — impersonation (admin+end users / end users) across orgs
- `IAM_LOGIN_CLIENT` — all permissions needed to implement your own login UI (give this to the login v2 service account)

**Organization level**
- `ORG_OWNER` — manage everything within the org
- `ORG_OWNER_VIEWER` — view everything within the org
- `ORG_USER_MANAGER` — manage users and their authorizations
- `ORG_USER_PERMISSION_EDITOR` — manage user grants
- `ORG_PROJECT_PERMISSION_EDITOR` — grant projects to other orgs
- `ORG_PROJECT_CREATOR` — create and manage projects
- `ORG_ADMIN_IMPERSONATOR` / `ORG_END_USER_IMPERSONATOR` — impersonation within the org

**Project level**
- `PROJECT_OWNER` / `PROJECT_OWNER_VIEWER` — manage/view everything in a project (incl. user grants)
- `PROJECT_OWNER_GLOBAL` / `PROJECT_OWNER_VIEWER_GLOBAL` — same, in the global organization

**Project grant level**
- `PROJECT_GRANT_OWNER` — PROJECT_OWNER powers on a granted project (this is what a customer org's admin uses to assign your app's roles to their users)

## B2B multi-tenancy recipe

1. One org per business customer; each keeps its own users, IdPs (Okta/Entra/Google per org), branding, login policy.
2. Your product = a project in *your* org; define roles there.
3. Grant the project to each customer org with a restricted role subset.
4. Make a customer admin `ORG_OWNER` (or `PROJECT_GRANT_OWNER`) in their org → delegated administration, no central involvement.
5. Route users to their org at login via `urn:zitadel:iam:org:id:{id}` / `urn:zitadel:iam:org:domain:primary:{domain}` scopes, or rely on domain discovery / default org.
6. For an in-app admin dashboard that manages role assignments, call the Management API **with the acting user's token** (not a machine token) to keep the audit trail honest.
