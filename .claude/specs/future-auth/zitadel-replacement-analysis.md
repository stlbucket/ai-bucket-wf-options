# future-auth: ZITADEL vs the fnb user/tenant/licensing/permissions scheme

Status: analysis (historical baseline). **Scenario 1 was implemented 2026-07-08/09** — see
`zitadel-login-pattern.md` for the as-built contract. Section 1 below describes the pre-cutover
baseline (`auth.user` etc. are now dropped). Written 2026-07-08 against the `zitadel`
branch schema (`db/fnb-auth`, `db/fnb-app`) and current ZITADEL docs (see
`.claude/skills/zitadel-expert/`).

## 1. What we have today (baseline for comparison)

**Identity (fnb-auth)**
- `auth.user` — email + `crypt()`-hashed password, confirmation/recovery token columns
  (Supabase-shaped, mostly unused)
- `auth.identities` — external-provider link table (currently unused in practice)
- `auth.login_user(email, password)` + auth-app endpoints `login` / `logout` / `change-password`;
  httpOnly `session` cookie is the root of trust

**Tenancy + authorization (fnb-app)**
- `app.profile` — platform-wide person (1:1 with `auth.user` by email)
- `app.tenant` — tenant (`anchor|customer|demo|test|trial`)
- `app.resident` — membership: profile × tenant, `type home|guest|support`, status lifecycle
  `invited → active | declined | blocked_*`. **One `active` residency per profile at a time**
  (`idx_uq_resident`), one `home` tenant ever (`idx_uq_home_resident`) — tenant *switching*, not
  simultaneous membership
- Licensing: `app.application` / `app.module` / `app.tool` (nav catalog),
  `app.permission`, `app.license_type` (+ `assignment_scope`), `app.license_pack`,
  `app.license_pack_license_type` (seat counts, expiration intervals),
  `app.license_type_permission`, `app.tenant_subscription`, `app.license`
- Claims: `app_fn.current_profile_claims()` computes `ProfileClaims` (profileId, tenantId,
  residentId, actualResidentId, permissions[], modules/tools nav) from the **active resident's
  active licenses** → GraphQL → localStorage → `pgSettings('request.jwt.claims')` → `jwt.*`
  helpers → RLS on every table

The load-bearing chain is `license → license_type → permissions[] → jwt.has_permission() → RLS`.
Licensing *is* the permission system; permissions are seat-limited, subscription-gated, expiring
entitlements — not static roles.

## 2. Capability mapping

| fnb concept | ZITADEL concept | Fidelity |
|---|---|---|
| `auth.user` (password, recovery) | Human user (password, MFA, passkeys, email verification, lockout) | **Superset — clean win** |
| `auth.identities` | Federated users / linked IdPs (Google, Entra, SAML…) | **Superset — clean win** |
| `app.profile` | User profile + user metadata | Partial (display_name/avatar/is_public are app concerns) |
| `app.tenant` | Organization | Good (branding, per-org IdPs, domains — a superset for identity, but no `type`/`status` semantics) |
| `app.resident` (membership) | Role assignment (user grant), possibly to a granted project in another org | Weak — no `invited/declined/blocked` lifecycle, no `home/guest/support` types, no impersonation trail (`actual_resident_id`) |
| `app.permission` / `license_type_permission` | Project roles (static key + display name + group) | Weak — flat static keys, no grouping into licenses |
| `app.license_*`, `app.tenant_subscription` | **Nothing** | **No equivalent.** No seat counts, no packs, no subscriptions, no per-assignment expiry |
| `app.module` / `app.tool` (nav) | Nothing | App concern, stays regardless |
| Tenant switching / multi-tenant users | One home org per user + cross-org role assignments via project grants; roles claim is `{roleKey: {orgId: orgDomain}}` | Different shape — all memberships at once in the token, no "active tenant" notion |
| Support impersonation (`type='support'`, `actual_resident_id`) | Token exchange impersonation + `*_IMPERSONATOR` manager roles | Plausible replacement, different mechanics |
| Sub-tenant scope ("customers") | **Nothing** — hierarchy is flat: instance → org → project | **No second level.** Must be modeled app-side or by flattening customers into orgs |

Two structural mismatches drive everything below:

1. **ZITADEL has no licensing.** Roles are free, static, unlimited. Seat counting, license packs,
   subscriptions, expiry — the heart of `fnb-app` — must live in our DB in *both* scenarios.
2. **ZITADEL has no sub-org.** A "customer under a tenant" has no native home; orgs are one flat
   level under the instance.

---

## 3. Scenario 1 — ZITADEL for login only (basic user info back)

fnb keeps profile/tenant/resident/licensing/RLS exactly as-is. ZITADEL replaces password
authentication: auth-app's login page becomes an OIDC code+PKCE redirect (or later a
session-API custom UI); the callback exchanges the code, reads `sub` + `email` (+ name), maps to
`app.profile`, computes `ProfileClaims` exactly as today, and sets the same httpOnly `session`
cookie. The session cookie stays the root of trust; ZITADEL tokens never reach the browser or
PostGraphile.

### Tables/objects removed

| Object | Disposition |
|---|---|
| `auth.user` | **Drop.** Replaced by ZITADEL human users |
| `auth.identities` | **Drop.** ZITADEL owns IdP links |
| `auth.login_user()`, password/recovery/confirmation logic | **Drop** |
| auth-app `login.post.ts`, `change-password.post.ts` | Replaced by OIDC redirect + callback; password change becomes a link to ZITADEL self-service (or session API later) |
| `app.profile` | **Keep**, add `idp_user_id text unique` (ZITADEL `sub`) |
| Everything else in `app.*`, `jwt.*`, all RLS | **Unchanged** |

Net: −2 tables, −1 password surface we no longer own (hashing, recovery, lockout, MFA-someday —
all become ZITADEL's problem, and we gain passkeys/MFA/social login for free).

### App changes

- auth-app: login → `GET {zitadel}/oauth/v2/authorize?...` with PKCE; new `/auth/callback`
  server route does the token exchange, provisions/links `app.profile` (match by verified email
  on first login, then by `idp_user_id`), builds claims, sets session cookie. Logout additionally
  hits `/oidc/v1/end_session`.
- Invitation flow: `app_fn` invites residents by email today; on invite either (a) pre-create the
  ZITADEL user via the user v2 API and send ZITADEL's invite email, or (b) leave it lazy — the
  resident row stays `invited` until the person first logs in through ZITADEL and the callback
  matches by email. (b) is nearly zero code.
- Infra: one ZITADEL container (+ Postgres — can share the instance with a separate DB) + nginx
  location. Caveats: proxy must pass **h2c** upstream and preserve `Host`; masterkey is
  immutable; seed a service-account PAT via FirstInstance steps for automation.
- fnb keeps working offline/dev with a seeded ZITADEL the same way the DB is seeded today.

### Effort / risk

Small and contained: auth-app + a sqitch change for `idp_user_id` + drop of `fnb-auth` tables.
No RLS, no PostGraphile, no tenant-app changes. Risk is mostly operational (one more stateful
service; login is down if ZITADEL is down).

---

## 4. Scenario 2 — ZITADEL manages multi-tenancy for all users

Mapping: `app.tenant` → **organization**; fnb = one **project** (in our anchor org) granted to
every tenant org; membership = **role assignments** on the granted project; tenant admins get
`ORG_OWNER` (or `PROJECT_GRANT_OWNER`) for delegated self-service; tokens carry
`urn:zitadel:iam:org:project:roles` = `{roleKey: {orgId: orgDomain}}`, from which we derive
tenant membership + permissions.

### What this buys

- Tenant admins manage their own users/IdPs/branding in ZITADEL Console (or via our UI calling
  the management API with the acting user's token, preserving audit) — invitation emails, MFA
  policy, SSO-per-tenant all come free.
- Multi-tenant membership becomes native: a user's token lists *all* orgs where they hold roles,
  simultaneously — strictly more expressive than today's one-active-resident switching model.
- True enterprise-tenant story: `acme.ch` domain claiming, Entra federation per tenant.

### What it cannot replace (the hard stops)

1. **The entire licensing stack stays.** `license_type`, `license_pack`,
   `license_pack_license_type` (seat counts −1/0/n, expiration intervals), `tenant_subscription`,
   `license` (+ the anchor-tenant unique indexes) have no ZITADEL counterpart. If permissions
   must remain seat-limited and subscription-gated, fnb must still decide *which permissions a
   user has* — ZITADEL roles could only mirror the *result*.
2. **Resident lifecycle.** `invited/declined/blocked_individual/blocked_tenant/supporting`,
   `home/guest/support` types, `invited_by_*` provenance — ZITADEL user grants are binary. This
   either degrades to user-metadata blobs (unqueryable, un-RLS-able) or the `resident` table stays.
3. **FK gravity.** `license`, `support_ticket`, `support_ticket_comment` — plus the msg/todo/loc/
   wf/storage modules — FK onto `resident`/`tenant`. RLS policies join through them. Dropping
   the tables means every module's policies rewrite against claim-parsed org IDs; keeping them
   means they become **mirrors** synced from ZITADEL.

### Realistic shape: mirror-and-sync

- `app.tenant` gains `zitadel_org_id`, becomes a mirror (fnb still owns `type`/`status`).
- `app.resident` stays as the local projection of "user grant + lifecycle we still own."
- Sync: Actions v2 **event executions** (org created, user added, grant changed → webhook target
  in graphql-api-app or a worker task) plus a reconciliation job via a service account
  (private-key JWT with `urn:zitadel:iam:org:project:id:zitadel:aud`). Two sources of truth with
  eventual consistency — this is the tax.
- Claims: either keep computing `ProfileClaims` from local mirrors (least change — ZITADEL is
  then really only *managing* tenancy, not *serving* it), or parse the roles claim from the token
  and intersect with local license state (two systems consulted per login).

### Tables removed in scenario 2

| Object | Disposition |
|---|---|
| `auth.user`, `auth.identities` | **Drop** (as scenario 1) |
| `app.tenant` | Slims to a mirror row (id, `zitadel_org_id`, type, status) — not dropped |
| `app.resident` | Stays (lifecycle + FK target), sync-updated |
| `app.permission`, `license_type_permission` | Could re-home as project roles, but since licensing decides assignment, keeping them local is simpler; pushing them to ZITADEL adds role-sync for zero authz gain |
| All `license*`, `tenant_subscription`, `application/module/tool`, support tables | **Stay** |

Net honest count: scenario 2 drops the same two `auth.*` tables as scenario 1, demotes
`app.tenant` to a mirror, and adds a sync subsystem. It removes almost no schema while adding
distributed-state complexity. Its value is the *delegated identity administration and per-tenant
SSO*, not schema reduction.

---

## 5. Second-level scope: tenants → customers → users, with cross-membership

Requirement: tenants can create **customers**; users live within customers; any user may belong
to multiple tenants *and* multiple customers across the platform.

First, independent of ZITADEL: today's schema forbids simultaneous membership
(`idx_uq_resident` = one active residency; claims carry a single `tenantId`). Any version of this
feature requires:

- dropping the one-active-resident constraint (or reinterpreting it as "selected context"),
- an `app.customer (id, tenant_id fk, name, status)` table,
- an `app.customer_member (customer_id, resident_id | profile_id, status, type)` table,
- claims growing a customer dimension — either `customerId` for a selected context (keeps RLS
  helpers nearly as-is: add `jwt.customer_id()`), or arrays of memberships with RLS policies
  checking `tenant_id = any(...)` — the *selected-context* model is far less invasive,
- permission scoping rules: which license types are grantable at tenant scope vs customer scope
  (`license_type_assignment_scope` gains a `customer` value, or licenses gain `customer_id`).

### Scenario 1 + customers

Entirely app-side; ZITADEL is oblivious (it only authenticates people). All work above happens in
`fnb-app` + claims + RLS. No ZITADEL constraint applies. **This is the clean path** — the
two-level scope is just more rows and one more claim field; the design freedom is total (seat
counts per customer, customer-scoped license packs, etc.).

### Scenario 2 + customers

ZITADEL's hierarchy is flat — no sub-organizations. Three options:

- **(a) Customers as orgs too** (flatten): every customer is another org; fnb keeps the
  tenant→customer edge locally. Consequences: org explosion (tenants × customers); tenant admins
  need `ORG_OWNER` in every customer org (grantable, but there is no "manage this subset of
  orgs" manager role — instance-level `IAM_ORG_MANAGER` is too broad); org creation is
  instance-privileged, so "tenant adds a customer" becomes an fnb-mediated service-account call;
  the roles claim's `{orgId: domain}` map now mixes tenant orgs and customer orgs and fnb must
  classify each ID against its local edge table. Workable, ugly, and every customer op is a
  cross-system transaction.
- **(b) Customers app-side, tenants in ZITADEL**: orgs stop at tenant level; customers and
  customer membership are fnb tables exactly as in scenario 1. Two membership systems of
  different kinds (org role assignments for tenants, rows for customers) — conceptually muddy
  but operationally sane.
- **(c) Encode customers in role keys or metadata** (`c:{customerId}:p:whatever`): dynamic role
  creation per customer via API, unbounded role lists in tokens, no delegated admin UI semantics.
  Rejected.

Cross-membership itself (user in many tenants + many customers) is the one thing scenario 2 does
naturally at the *tenant* level (roles claim spans orgs) — but since customers can't be orgs-
under-orgs, the customer half degrades to app-side rows anyway, dragging the whole feature's
source of truth back into fnb.

---

## 6. Recommendation

**Adopt scenario 1; decline scenario 2; build customers app-side.**

- Scenario 1 removes the only part of the current scheme that is a liability to own (password
  auth: hashing, recovery, verification, lockout, MFA, social/enterprise SSO) and touches nothing
  else. The auth-app + `idp_user_id` change is small; RLS, licensing, PostGraphile, and every
  module are untouched. It also leaves the door open: tenants-as-orgs can be layered on later,
  since profiles would already be keyed by ZITADEL `sub`.
- Scenario 2's genuine wins (per-tenant SSO/IdP, delegated user administration, native
  multi-org membership) come bundled with a permanent sync subsystem, a demoted-but-not-deleted
  schema, and zero help on licensing — which is the actual center of gravity of fnb's
  authorization. If per-tenant enterprise SSO becomes a requirement, prefer the *narrow* version:
  stay on scenario 1 and use one ZITADEL org per enterprise tenant **only for IdP routing**
  (`urn:zitadel:iam:org:id:{id}` scope at login), keeping membership/authorization entirely in fnb.
- The customer sub-scope requirement is the deciding argument: it cannot live natively in ZITADEL
  under either scenario, and once customers are app-side tables with claims/RLS support, keeping
  tenant membership app-side too (scenario 1) gives one consistent model for both levels instead
  of a split brain.

### Sketch of the scenario-1 target state

```
ZITADEL (login only)          fnb (unchanged authority)
┌──────────────────┐          ┌────────────────────────────────────────┐
│ human users       │  OIDC   │ app.profile (+ idp_user_id)            │
│ passwords/passkeys│ ──────► │ app.tenant / app.customer (new)        │
│ MFA, social IdPs  │  code+  │ app.resident / app.customer_member(new)│
│ email verification│  PKCE   │ licensing stack → permissions[]        │
└──────────────────┘          │ ProfileClaims (+ customerId)           │
                              │ pgSettings → jwt.* → RLS               │
                              └────────────────────────────────────────┘
```

Open questions to settle before any implementation spec:
1. Self-host ZITADEL in the compose stack vs ZITADEL Cloud (masterkey/backup ownership vs ops).
2. Hosted login v1 (fastest) vs login v2 vs session-API custom UI (brand fidelity) — passkeys are
   domain-bound, so pick the login domain once.
3. Invite flow: pre-provision ZITADEL users on invite (their email) vs lazy match on first login
   (ours) — affects who sends the invitation email.
4. Multi-membership UX: selected-context claims (recommended) vs array claims in RLS.
