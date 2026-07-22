# Can we move the fnb tenant/permission model into ZITADEL?

**Feasibility assessment — for evaluator review**
Date: 2026-07-21

## The question

Can we convert the entire fnb **tenant / profile / resident / license / subscription /
application / permission** structure by moving it into ZITADEL's org / customer model?

## Bottom line

**Partially — and where it fits, we'd want to. But not "all of it."**

ZITADEL can become the system of record for **identity, tenancy, and coarse roles**. Three of
the seven concepts — **residents, licenses/subscriptions, and RLS-enforced permissions** —
either have no ZITADEL analog or must remain in PostgreSQL regardless. The realistic outcome is
an **integration** (ZITADEL as an upstream authority feeding our existing claims pipeline), not
a **decommission** of the fnb data model.

This is a natural extension of where we already are: ZITADEL already owns the login ceremony and
the `idp_user_id` linkage.

## Terminology correction (important for the framing)

ZITADEL's hierarchy is **Instance → Organization → Project → Application → User**, plus
**project grants** for B2B delegation.

- There is **no "business unit"** tier between org and user. That concept does not exist in
  ZITADEL.
- "Customers" is not a native object either — the closest thing is *granting your Project to
  another Organization* (delegated B2B access).

So the real design model is not "org / business-unit / customer." It is one of:

1. **One Organization per tenant**, or
2. **Our Organization + project-grants out to customer Organizations.**

That fork is the single biggest architectural decision (see "Design fork" below).

## Concept mapping

| fnb concept | ZITADEL equivalent | Verdict |
|---|---|---|
| `app.tenant` | **Organization** | Clean fit — both are the isolation boundary |
| `app.profile` | **User** (human) | Already linked via `idp_user_id` |
| `app.application` / project | **Project** + Applications | Fits — this is exactly what Projects are for |
| `app.permission` (`p:*`) | **Project roles** | Works, but the token claim shape differs |
| `app.license_type` | Project role (+ user metadata) | Loses `assignment_scope` nuance |
| `app.resident` | Org membership / user-grants | **Structural mismatch** |
| `app.license` + `app.tenant_subscription` + `app.license_pack` | *(no equivalent)* | **No analog — billing/entitlements** |

## The three blockers

### 1. Residents violate ZITADEL's one-user-one-org rule

A ZITADEL user belongs to **exactly one org and is never transferable**. Our `resident` model
is the opposite: one profile can hold many tenant memberships, each with a rich lifecycle
(`invited │ declined │ active │ inactive │ blocked_individual │ blocked_tenant │ supporting`),
plus `assume_residency` (active-residency switching) and **support mode** (a profile
temporarily assuming a `type='support'` resident *inside another tenant*, with temporary
licenses granted).

ZITADEL's only way to express multi-org access is: the user lives in a home org and receives
**user-grants into other orgs' granted projects**. That covers "member of several tenants," but:

- The resident lifecycle states are far coarser in ZITADEL (a grant either exists or it does not).
- `assume_residency` and support-mode license-granting are **custom business logic** with no
  primitive equivalent. Moving them to ZITADEL means reimplementing them against the ZITADEL
  API — not replacing them with built-ins.

### 2. Licenses / subscriptions / packs have no ZITADEL model at all

ZITADEL roles are boolean grants. There is **no seat count, no `number_of_licenses`, no
`auto_subscribe`, no expiration, no subscription object**. These are commercial entitlement
semantics. They **must stay in our DB** regardless of what happens to identity.

### 3. RLS still needs claims in Postgres — ZITADEL cannot own enforcement

The entire data layer enforces access via PostgreSQL **RLS** keyed on `jwt.uid()`,
`jwt.tenant_id()`, and `jwt.has_permission()`, all reading `request.jwt.claims` through
`pgSettings`. Even if ZITADEL becomes the source of truth for roles, those roles still have to
be projected into `ProfileClaims` → `pgSettings` for any RLS policy to fire.

**ZITADEL is the authority; PostgreSQL stays the enforcement point.** "Move permissions into
ZITADEL" therefore means "source them from ZITADEL, keep enforcing them in RLS."

A secondary detail: ZITADEL's roles claim is a **nested object** (`role → orgID → orgDomain`),
not our flat `permissions: string[]`. We would flatten it in the auth-app OIDC callback or in a
ZITADEL Action.

## Realistic target architecture (hybrid)

**ZITADEL owns**
- The login ceremony (already true).
- Profile / user identity (already true via `idp_user_id`).
- The **tenant ↔ org** mapping and org membership.
- **Coarse role assignment** — our `p:*` keys expressed as project roles.

**fnb keeps**
- The `resident` lifecycle and support mode.
- `license` / `license_type` / `license_pack` / `tenant_subscription` (entitlements + billing).
- Nav / module / tool registration (DB-driven, rule R14).
- **All RLS enforcement.**

**The bridge**
On OIDC callback, read org membership + roles from the verified token, reconcile them against
`app.profile` / `app.resident`, then assemble `ProfileClaims` exactly as today. ZITADEL becomes
an upstream source that feeds the existing claims pipeline rather than replacing it.

## Design fork — the main decision to make

| Option | Pros | Cons |
|---|---|---|
| **One Organization per tenant** | Cleanest isolation | Every cross-tenant user (support staff, multi-tenant members) needs duplicate users or grant gymnastics — **this is where support mode gets painful** |
| **Our Org + B2B project grants to customer Orgs** | Matches "platform + customers"; keeps each user single | Tenant self-administration becomes ZITADEL delegated-admin, which is coarser than our resident/license model |

## Nested workspaces — the sharpest mismatch

fnb supports **nested tenants** via `app.tenant.type = 'workspace'` with a `parent_tenant_id`
self-FK. This is more demanding than the flat tenant model, and it maps to ZITADEL the worst.

### What a workspace actually is (from the schema)

- **A full tenant, not a lightweight sub-area.** Each workspace has its own residents, its own
  `tenant_subscription` (to the `workspace` pack), its own licenses, and its own RLS boundary
  keyed on `tenant_id`.
- **Arbitrary depth.** The only structural rule is
  `constraint chk_workspace_parent check ((type = 'workspace') = (parent_tenant_id is not null))`.
  A workspace's parent may itself be a workspace, so nesting is unbounded.
- **Sibling-scoped naming.** Names are globally unique for root tenants but per-parent for
  workspaces (`idx_uq_tenant_name_sibling`).
- **Parent-admin read-down, one level, SELECT-only.** Four dedicated RLS policies let a
  `p:app-admin` *see* the residents / subscriptions / licenses / tenant rows of **direct-child**
  workspaces (`parent_tenant_id = jwt.tenant_id()`). Writes flow only through
  `app_api.create_workspace` / `activate_workspace` / `deactivate_workspace`.
- **Any tenant admin can spawn one.** `create_workspace` is `SECURITY DEFINER`, auto-subscribes
  the `workspace` pack, and seats the creator as a guest admin resident.

So the structure ZITADEL would need to represent is a **tree of full isolation boundaries with
read-down inheritance**.

### The blocker: ZITADEL organizations are flat

**There is no native nested-org / sub-org / org-tree concept in ZITADEL.** Organizations have no
parent. The workspace hierarchy has no structural home. The three options, all imperfect:

| Option | How | Why it falls short |
|---|---|---|
| **A. One org per workspace + parent pointer in org metadata** *(best fit)* | Every workspace is its own flat org, like roots; store `parent_org_id` as org metadata | ZITADEL treats the parent id as **opaque data it enforces nothing about** — no read-down manager scope, no descendant walk, no sibling-name rule |
| **B. Workspaces as Projects inside the parent org** | Root = org, workspaces = projects within it | Projects aren't user/data isolation boundaries — all workspace residents collapse into the parent org's user pool, killing per-workspace resident isolation; projects don't nest either |
| **C. B2B project grants** | Each workspace its own org; parent grants its project down | One level of delegated admin only; grants are point-to-point and ZITADEL never reasons about the chain as a *tree* — multi-level nesting becomes grant spaghetti |

### What this means

**Option A is the only one that preserves the isolation model, and it makes ZITADEL
hierarchy-blind.** Everything that makes a workspace a *workspace* rather than just another org
stays in Postgres:

- the four parent-admin read-down RLS policies,
- sibling-scoped name uniqueness,
- the `create` / `activate` / `deactivate_workspace` lifecycle,
- arbitrary-depth nesting and any descendant traversal.

ZITADEL would mirror only the **flat set of orgs**; the **edges of the tree live in our DB** (or
in inert metadata ZITADEL ignores).

This also amplifies the resident-vs-single-org tension from the first section. Because each
workspace is its own org and **ZITADEL users are single-org**, one human who is a resident of a
root tenant *and* several nested workspaces fans out into multiple ZITADEL users (or one
home-org user with a grant into each workspace org). `create_workspace` already mints a fresh
guest resident per workspace — that maps to a per-org user-grant — but the "one person, N-deep
workspace memberships" fan-out is the same single-org tension, now multiplied by tree depth.

## Summary judgment

- **Wholesale move of everything into org / business-unit / customer: no.** There is no
  business-unit tier, the resident model violates one-user-one-org, there is no
  entitlement/billing primitive, and **ZITADEL has no nested-org concept for workspaces**.
- **Hybrid — ZITADEL owns identity + tenancy + coarse roles; fnb keeps residents / licenses /
  subscriptions / RLS: yes, and it is a sensible evolution** of the current cutover. But it is
  an integration, not a decommission. We do not get to delete `app.resident`, the `app.license*`
  tables, the RLS layer, or the workspace-tree logic.
- **The tenant tree is fnb business logic that Postgres must keep owning.** At most, ZITADEL
  holds the flat org set; the hierarchy itself — nesting, read-down visibility, lifecycle — is
  enforced only in the DB.
