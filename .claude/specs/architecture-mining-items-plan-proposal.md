# Architecture Directory Content Audit

## Context

The `.claude/architecture/` directory (11 files) is being retired. Before deleting it, this
audit identifies every piece of information that is NOT already captured in `.claude/specs/`
and flags it for possible migration.

**Already captured in specs** (skip list): monorepo bootstrap, Docker Compose topology,
nginx routing, package-layers inventory, db-generate workflow, pg-notify-bridge explanation,
app scaffold boilerplate, global R1–R20 rules, REST API pattern, WebSocket pattern, UI rules,
high-level security model, withClaims signature, ProfileClaims fields, permission key table.

---

## Itemized Findings: Content NOT Yet in Specs

### Group A — Security & Auth (from `04-security.md`)

**A1. Complete JWT payload structure (buildJwtPayload)**
The exact JSON shape written into Postgres `request.jwt.claims` — not just the TypeScript type,
but the nested `user_metadata` wrapper that auth helper functions actually read from:
```json
{
  "email": "...",
  "display_name": "...",
  "user_metadata": {
    "profile_id": "uuid",
    "tenant_id": "uuid",
    "resident_id": "uuid",
    "actual_resident_id": "uuid",
    "permissions": ["p:app-user", "p:app-admin"]
  }
}
```
Currently missing: the implementor skill describes the TypeScript `ProfileClaims` shape but not
the `buildJwtPayload` output that `auth.*()` SQL helpers actually parse.

**A2. All `auth.*()` SQL helper function implementations**
The auth schema functions called by RLS policies — with their actual SQL bodies:
```sql
auth.uid()            → (jwt()->'user_metadata'->>'profile_id')::uuid
auth.tenant_id()      → (jwt()->'user_metadata'->>'tenant_id')::uuid
auth.resident_id()    → (jwt()->'user_metadata'->>'resident_id')::uuid
auth.permissions()    → ARRAY(SELECT jsonb_array_elements_text(jwt()->'user_metadata'->'permissions'))::citext[]
auth.has_permission(key, tenant_id) → key = ANY(auth.permissions()) AND auth.tenant_id() = tenant_id
auth.enforce_permission(key)        → IF NOT auth.has_permission(key) THEN RAISE EXCEPTION
```
The implementor skill names these functions but doesn't document their SQL bodies.

**A3. Complete RLS policy reference (all tables)**
Every RLS policy by table with exact `USING`/`WITH CHECK` conditions. Currently the implementor
skill has a template pattern; this is the full per-table inventory:
- `auth.user`: view_self, update_self, manage_all_super_admin
- `app.profile`: view_self, update_self, manage_all_super_admin
- `app.resident`: 5 policies (view_own_resident_email, view_own_resident, update_own_resident,
  manage_own_tenant_residencies, manage_all_super_admin)
- `app.tenant`: 3 policies
- `app.tenant_subscription`: 2 policies
- `app.license`: 3 policies
- Reference tables (application, license_type, etc.): view_all_users (SELECT WHERE 1=1)

**A4. NOINHERIT — why authenticator must not inherit authenticated**
Explanation: if authenticator inherited from authenticated, any query run outside withClaims
would execute as authenticated with empty claims — RLS would fire against nulls. NOINHERIT
prevents this and is the key reason the bootstrap function is necessary.

**A5. Login API cookie options (exact values)**
The `setCookie` call in login.post.ts — `sameSite: 'lax'`, `maxAge: 60*60*24*7`,
`secure: process.env.NODE_ENV === 'production'`, `httpOnly: true` for session vs `false` for
auth.user. The fact that the auth.user cookie can be stale (it's a convenience cache; server
re-fetches from DB on every request via the session cookie) is a subtle but important point.

**A6. Security properties enforcement table**
A table mapping each security property (no cross-tenant leakage, permission changes take effect
immediately, no JWT forgery, bcrypt, httpOnly session, transaction-local claims, superadmin
isolation) to exactly how it is enforced. Useful for understanding why the architecture is
shaped this way.

---

### Group B — Licensing & Permissions (from `05-licensing-permissions.md`)

**B1. Assignment scope definitions**
The `assignment_scope` enum values explained:
| Scope | Meaning |
|-------|---------|
| user | Grantable to any user by an admin |
| admin | One per tenant (partial unique index) |
| superadmin | Anchor tenant only |
| support | Anchor tenant only |
| none | Can't be individually assigned |
| all | Auto-granted to everyone in tenant |
Currently only mentioned by name in the implementor skill, never defined.

**B2. Built-in license types reference table**
Complete table of what ships with the anchor application:
- app-user → p:app-user, scope: user
- app-admin → p:app-user + p:app-admin, scope: admin
- app-admin-super → p:app-user + p:app-admin + p:app-admin-super, scope: superadmin
- app-admin-support → p:app-user + p:app-admin + p:app-admin-support, scope: support
- app-address-book → p:address-book, scope: user

**B3. License pack mechanics**
`number_of_licenses` semantics: `-1` = unlimited, `0` = tenant-level (one shared), `N` = hard cap.
`auto_subscribe`: every new tenant auto-subscribes to packs where this is true.
The distinction between `anchor` pack (NOT auto_subscribe, only anchor tenant can subscribe)
and `base` pack (auto_subscribe, every tenant gets it) is the core of the permission model.

**B4. Module/Tool navigation structure for anchor application**
The complete tree showing which module/tool maps to which permission and route:
```
anchor application
├── base-tools module (p:app-user)      → profile tool → /profile
├── base-admin module (p:app-admin)     → users → /admin/user
│                                       → licenses → /admin/license
│                                       → subscriptions → /admin/subscription
└── base-site-admin (p:app-admin-super) → tenants → /site-admin/tenant
                                         → users → /site-admin/user
                                         → applications → /site-admin/application
```

**B5. `install_basic_application` call signature**
The exact SQL pattern for registering a new module — including the `ROW(...)::app_fn.module_info[]`
casting syntax, ordinal integers, and what it creates (application, module, tool, license_type,
permission, license_pack, auto-subscribe existing tenants).

**B6. Nav section registration pattern (nav-register.ts plugin)** — ~~MOOT / do not mine~~
The `nav-register.ts` / `useNavRegistry()` plugin pattern this item proposed documenting is
**retired** — it no longer exists in code. Nav is entirely claims-driven: DB `app.module`/`app.tool`
rows → `ProfileClaims.modules` → `useAppNav().availableSections` (`packages/tenant-layer`), with
permission gating done at the DB when claims are built (R14). Nothing to mine here.

---

### Group C — Special Cases & Constraints (from `06-special-cases.md`)

**C1. Three partial unique indexes enforcing anchor tenant exclusivity**
```sql
UNIQUE on license_pack_license_type(license_pack_key) WHERE license_type_key = 'app-admin-super'
UNIQUE on license_pack_license_type(license_pack_key) WHERE license_type_key = 'app-admin-support'
UNIQUE on tenant_subscription(id)                     WHERE license_pack_key = 'anchor'
```
Together: only one pack can have super/support types, and only one tenant can subscribe to
anchor pack. This is the DB-level enforcement of the anchor tenant concept.

**C2. Three residency uniqueness constraints**
```sql
UNIQUE on resident(profile_id) WHERE status = 'active'        -- one active at a time
UNIQUE on resident(profile_id) WHERE type = 'home'            -- one home ever
UNIQUE on resident(tenant_id, profile_id, type)               -- one per (tenant, profile, type)
```
The first is the single-active-tenant invariant; the second prevents re-creating home residency.

**C3. Invited users — `view_own_resident_email` RLS policy**
`profile_id` is nullable on `app.resident`. Before a user registers, they can be invited by
email alone. The policy `SELECT WHERE auth.jwt()->>'email' = email AND auth.tenant_id() = tenant_id`
allows them to see their pending invitation. This is a special policy that would be easy to miss.

**C4. `handle_new_user` trigger chain**
When `auth.user` INSERT fires:
→ `app_fn.handle_new_user()` (SECURITY DEFINER)
→ INSERT `app.profile` (email, display_name = split_part(email,'@',1))
→ UPDATE `app.resident` SET profile_id = new.id WHERE email matches AND not blocked

**C5. `display_name` propagation trigger pattern**
When `app.profile.display_name` changes, per-module triggers fire:
`msg_fn.handle_update_profile()` → UPDATE `msg.msg_resident SET display_name = ...`
Same pattern in fnb-todo. Keeps display_name consistent across shadow tables.
Not mentioned in any current spec — a real gotcha when adding a new module.

**C6. `profile_claims_for_user` vs `current_profile_claims` — when to call which**
`profile_claims_for_user(user_id)` — for middleware (takes auth.user.id from session cookie,
SECURITY DEFINER, granted to authenticator, joins auth.user → profile by email).
`current_profile_claims(profile_id)` — for login route and API routes that re-assemble claims.
The distinction: only the first is callable without existing claims.

**C7. Self-modification prevention in grant_user_license**
`app_fn.grant_user_license` checks `current_user_resident_id != resident_id` before deleting
existing scoped licenses. Prevents an admin from revoking their own admin license (which would
lock them out). Not mentioned anywhere in current specs.

---

### Group D — WebSocket / Real-Time Details (from `07-fnb-msg-steps-sockets.md`)

**D1. WebSocket upgrade auth — `upgrade()` hook semantics**
In `defineWebSocketHandler`, the `upgrade(request)` hook runs before the handshake completes.
Throwing a `Response` rejects with an HTTP error (no half-open connection). `peer.context`
set in `upgrade` is available in `open`/`close`/`message`. This is different from `open(peer)`
which fires after the connection is established.

**D2. VueUse `useWebSocket` SSR hazard**
`useWebSocket` from VueUse executes during SSR setup, requires `immediate: false` guards.
Using native `new WebSocket(...)` inside `onMounted` sidesteps SSR entirely and keeps
reconnect logic explicit. This is a real foot-gun when copying patterns from VueUse docs.

**D3. WebSocket horizontal scaling caveat**
The pg-notify-bridge and crossws pub/sub are in-memory per Nitro instance. In a multi-instance
deploy, peers on different nodes miss messages from other nodes. Fix: sticky-session load
balancer OR Redis adapter for crossws. Worth knowing before going to production.

**D4. pg NOTIFY channel naming constraints**
PostgreSQL channels are case-sensitive and capped at 63 bytes. The `topic:<uuid>:message`
pattern is 44 chars — within limits. Never interpolate arbitrary user input into a channel
name without length/content validation.

**D5. Why one pg client (not pool) for the bridge**
PostgreSQL supports unlimited LISTEN channels per connection. One dedicated `pg.Client` (not
pool) handles all topics — zero per-peer overhead. The pool would give the LISTEN to a random
connection in the pool, making it unreliable. The bridge client never runs queries; it is
dedicated to LISTEN/NOTIFY only.

**D6. crossws `peer.subscribe` vs hand-rolled channelPeers Map**
In the actual implementation, the bridge does NOT use `peer.subscribe(channel)` + `.publish()`.
It maintains its own `channelPeers: Map<string, Set<peer>>` and calls `peer.send()` directly.
This is because `peer.subscribe/publish` is the crossws API which had reliability issues.
The hand-rolled peer set is the production implementation in msg-layer.

---

### Group E — Become-Support Implementation (from `08-implement-become-support.md`)

**E1. Cookie refresh pattern after session-changing operations**
After `become_support` / `exit_support_mode` / `assume_residency`, the server must rewrite the
`auth.user` cookie so the client immediately reflects the new state. Pattern:
```typescript
const freshClaims = await appFn.profileClaimsForUser(db, claims.profileId!)
setCookie(event, 'auth.user', JSON.stringify(freshClaims), { httpOnly: false, ... })
```
The `session` cookie never changes — it still holds the same `auth.user.id`. The server
re-derives fresh claims from DB on the next request via the unchanged session cookie.

**E2. Support mode detection in UI**
`isInSupportMode = residentId !== actualResidentId`. Both come from the `auth.user` cookie
(ProfileClaims). The Exit Support button should live in `UserProfileStatus.vue` so it appears
on every page.

**E3. Permission check for become-support button**
Both `p:app-admin-support` AND `p:app-admin-super` can call `app_api.become_support`.
UI guard should check both: `permissions.includes('p:app-admin-support') || permissions.includes('p:app-admin-super')`.
Easy to get wrong if you only check one.

**E4. Tenant filtering — hide anchor tenant from support list**
Clicking Support on the anchor tenant succeeds but is meaningless. The tenant list should
filter out or disable the Support button for tenants with `type = 'anchor'`.

---

### Group F — Operational (from `09-log-management-tooling.md`)

**F1. Lazydocker recommendation**
`brew install lazydocker` — zero project changes, run in a separate terminal, navigate with
arrow keys, per-service log tailing, CPU/memory display. The only option requiring no project
changes. Dozzle is already in docker-compose.yml; Lazydocker is not documented anywhere.

---

### Group G — Database Deployment Order (from `01-architecture-overview.md`)

**G1. Sqitch package deployment dependency graph**
The mermaid diagram showing the explicit order:
`fnb-auth (extensions → auth schema → roles → auth policies)` → `fnb-app (app schema →
app_fn types+functions → app_fn_definers → app_fn_support → app policies → bootstrap)` →
`fnb-msg / fnb-todo / fnb-my-app (parallel)`.
Not captured anywhere in current specs. Critical for knowing which `sqitch.plan` dependencies
to declare when adding a new DB package.

---

## Selection Checklist

Mark each item: keep (migrate to specs) or drop.

- [ ] **A1** — JWT payload nested structure (`buildJwtPayload` output / `user_metadata` wrapper)
- [ ] **A2** — All `auth.*()` SQL helper function implementations
- [ ] **A3** — Complete RLS policy reference (all tables, all policies)
- [ ] **A4** — NOINHERIT explanation (why authenticator must not inherit authenticated)
- [ ] **A5** — Login cookie options (exact sameSite/maxAge/httpOnly values, stale-cache note)
- [ ] **A6** — Security properties enforcement table
- [ ] **B1** — Assignment scope definitions (user/admin/superadmin/support/none/all)
- [ ] **B2** — Built-in license types reference table
- [ ] **B3** — License pack mechanics (number_of_licenses -1/0/N, anchor vs base pack)
- [ ] **B4** — Module/Tool navigation structure for anchor application
- [ ] **B5** — `install_basic_application` call signature (exact SQL pattern)
- [~] **B6** — ~~Nav section registration pattern (nav-register.ts plugin)~~ MOOT — pattern retired, nav is claims-driven (see B6 detail above)
- [ ] **C1** — Three partial unique indexes enforcing anchor tenant exclusivity (exact SQL)
- [ ] **C2** — Three residency uniqueness constraints (exact SQL)
- [ ] **C3** — Invited users: `view_own_resident_email` RLS policy (nullable profile_id)
- [ ] **C4** — `handle_new_user` trigger chain (exact INSERT/UPDATE logic)
- [ ] **C5** — `display_name` propagation trigger pattern (per-module trigger naming)
- [ ] **C6** — `profile_claims_for_user` vs `current_profile_claims` — when to call which
- [ ] **C7** — Self-modification prevention in grant_user_license
- [ ] **D1** — WebSocket upgrade auth: `upgrade()` hook semantics, thrown Response behavior
- [ ] **D2** — VueUse `useWebSocket` SSR hazard (use native WebSocket in onMounted instead)
- [ ] **D3** — WebSocket horizontal scaling caveat (crossws is in-memory, Redis/sticky needed)
- [ ] **D4** — pg NOTIFY channel naming constraints (63-byte limit, case-sensitive)
- [ ] **D5** — Why one dedicated pg.Client (not pool) for the bridge
- [ ] **D6** — Bridge uses hand-rolled channelPeers Map, not crossws peer.subscribe/publish
- [ ] **E1** — Cookie refresh pattern after session-changing operations (become-support, etc.)
- [ ] **E2** — Support mode detection in UI (residentId !== actualResidentId, placement)
- [ ] **E3** — Permission check for become-support button (must check both super AND support)
- [ ] **E4** — Hide anchor tenant from support action list
- [ ] **F1** — Lazydocker recommendation (zero-project-change log viewer)
- [ ] **G1** — Sqitch package deployment dependency graph
