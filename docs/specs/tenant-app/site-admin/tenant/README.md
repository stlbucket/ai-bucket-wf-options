# site-admin/tenant — Tenant List + Detail (+ New Tenant modal)

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `docs/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
Implemented — GraphQL. New Tenant modal built 2026-07-27 (plan
`0150__app_______new-tenant-modal-site-admin_____MED__`); `pnpm build` gate passed, manual
e2e verification pending (user-run env).
Tenant-detail extension **built 2026-07-27** (plan
`0160__app_______site-admin-tenant-detail-users__MED__`, which also folded in the
user-invitation **U9 send-immediately checkbox**): users card (status + license badges),
read-only subscriptions card, workflow link mode + `TriggerWorkflowResult.result`. `pnpm build`
gate passed (13/13) + codegen against the restarted API; manual e2e pending (user-run env).

**Admin-identity extension — built 2026-07-30** (plan
`0650__app_______new-tenant-admin-identity_______MED__`, user directive same day): the New
Tenant modal grows **admin first/last name (required) + optional phone**, persisted on a
**pre-created `app.profile`** row via extended `create_tenant` params (the `initialize_anchor`
precedent). Supersedes the "Modal fields: Name + admin email only" and "DB changes: None"
locked decisions below. `pnpm build` gate passed (13/13) + codegen against the rebuilt API;
manual e2e pending (user-run env, Phase 12).

**Reversal (2026-07-27, user directive):** the cross-tenant invite surface was **removed** the
same day it was built — a super admin must NOT add (or re-invite) users from this page; they
enter **support mode** and do it from the tenant's own admin pages. Removed: the `[id]` page's
Invite User modal + per-row Send invite action, the `InviteUserModal`/`SendInviteModal`
`targetTenantId` props, `InviteUserInput.targetTenantId`, and the trigger plugin's whole
`targetTenantPermission`/`targetTenantId` pass-through. **Kept:** the read-only Users +
Subscriptions cards, the workflow link mode + `result: JSON` (used by the tenant-admin resend
and the U9 checkbox), and `SendInviteModal` itself (now consumed only by `admin/user/[id]`).

## Purpose
Site-admin (`p:app-admin-super`) tenant management at `/tenant/site-admin/tenant`: a list of all
platform tenants with support-mode entry, a detail page per tenant, and a
**New Tenant** button on the list page opening a modal that collects name + admin email and calls
the existing `app_api.create_tenant` infrastructure (auto license-pack subscription + admin
invite happen in the DB function; no new DB work).

The **tenant-detail extension** turns `[id]` into an overview: every resident of the tenant
(status badge, active license-type badges) and the tenant's subscriptions — both **read-only**.
User management (inviting, re-inviting, blocking, licenses) is deliberately NOT offered here:
the super admin enters **support mode** (the Support button on this page) and acts from the
tenant's own admin pages (user directive 2026-07-27; see the Reversal note in Status).

## Locked decisions
| Decision | Choice | Why |
|---|---|---|
| Modal fields | ~~Name + admin email only~~ **Name + admin first/last name (required) + admin email + optional phone** (2026-07-30) | Original 2026-07-27 directive kept the modal minimal; superseded by the 2026-07-30 admin-identity directive. Type still stays `'customer'`, identifier still `null`. |
| Tenant type select | Not offered | Same directive. Root-creatable alternatives (demo/test/trial) can be added later by extending the mutation doc. |
| Admin email required in the form | Yes | The SQL param is nullable but `app_fn.invite_user` inserts an `app.resident` row from it — a null email fails at the DB. The mutation doc already declares `$email: String!`. |
| Post-create behavior | Navigate to `/site-admin/tenant/{id}` | User choice 2026-07-27 — land on the detail page to review subscriptions + the invited admin. No list re-fetch needed. |
| DB changes | ~~None~~ **Extend `create_tenant` + pre-create the admin profile** (2026-07-30) | first/last/phone need a durable home and `app.resident` has no such columns — `app.profile` does. Extend `app_api`/`app_fn.create_tenant` with `_first_name`/`_last_name`/`_phone` (defaulted) and pre-create the profile before `invite_user` (`initialize_anchor` precedent; `provision_idp_user` links by email at first login). The missing `jwt.enforce_permission` gate stays a Known Gap. |
| Existing-profile collision | Blank-fill only | User pick 2026-07-30: if `_email` already has a profile, `coalesce` the three new fields into nulls only — a super admin never overwrites a user's self-maintained data. |
| Pre-created `display_name` | **Lowercase** first initial + last name (e.g. `jsmith`), fallback lowercased email local part, then null | User picks 2026-07-30 (lowercase directive at plan close). `display_name` is UNIQUE — fallbacks keep tenant creation from ever failing on a name collision. `invite_user` copies it onto the resident. |
| Phone handling | `PhoneSegments` (E.164), stored raw, no verification | User pick 2026-07-30: same pattern as the profile page (auth-layer shared component). The notify phone-verification ceremony (D13) stays the user's own later flow. |
| Duplicate-name handling | Error toast, modal stays open | DB raises `30002: APP TENANT WITH THIS NAME OR IDENTIFIER ALREADY EXISTS`; surface as "A tenant with this name already exists" (UC7). |

Tenant-detail extension (all user picks 2026-07-27; **superseded rows struck by the same-day
reversal — see Status**):

| Decision | Choice | Why |
|---|---|---|
| **No cross-tenant user management** (reversal) | The `[id]` page offers NO invite/re-invite affordances; the super admin enters **support mode** and acts from the tenant's own admin pages. The trigger plugin has no cross-tenant dispatch — `tenantId` always comes from claims. | User directive 2026-07-27, reversing the original `targetTenantId` pass-through decision: acting *inside* a tenant should always happen under that tenant's claims context, one auditable path. |
| "Copy link" content | The real onboarding ceremony link, obtained **synchronously** — workflow `responseMode` → `lastNode`, `mode: 'link'` skips the email and returns the URL; `TriggerWorkflowResult` gains `result: JSON` | A plain login URL was rejected: without ZITADEL's single-use code the invitee can't verify email or set a password. **Kept after the reversal** — consumed by the tenant-admin resend (`admin/user/[id]`) and the U9 checkbox. |
| Users + Subscriptions sections | Read-only (status/license badges; pack, status, license count) | Management stays on the admin pages (via support mode); this page is an overview. |
| DB work | None | `p:app-admin-super` already holds cross-tenant read RLS on resident/license/tenant_subscription. |

## Files in this spec
| File | Covers |
|---|---|
| `index.ui.md` | List page layout, `TenantList.vue`, support-mode entry, **New Tenant button + `NewTenantModal.vue`** |
| `index.data.md` | `SearchTenants`, `BecomeSupport`, **`CreateTenant` mutation + `useCreateTenant()` composable**, Known Gaps |
| `[id].ui.md` | Detail page layout + **read-only users card, subscriptions card** (invite affordances removed 2026-07-27) |
| `[id].data.md` | Detail data + **`AppTenantById` extension, workflow link mode, `useSiteAdminTenant` extensions** (the `targetTenantId` pass-through delta was removed 2026-07-27) |
| `../_shared.data.md` | Module-wide types, permissions, operations table (updated with `CreateTenant`) |

## Implementation Task List
Existing pages (retro-checked):
- [x] Tenant list page + `TenantList.vue` + support-mode entry
- [x] Tenant detail page (`[id]`)

New Tenant modal (built 2026-07-27):
- [x] **Phase 1 — client package**: `useCreateTenant()` added to
      `packages/graphql-client-api/src/composables/useSiteAdminTenants.ts` wrapping
      `useCreateTenantMutation` (hook was already generated — no codegen run needed);
      returns the mapped `Tenant`
- [x] **Phase 2 — tenant-app**: `useCreateTenant` re-exported in
      `apps/tenant-app/app/composables/useSiteAdminTenants.ts`; `NewTenantModal.vue` built on
      the `WorkspaceCreateModal.vue` precedent (owns trigger button, `create` emit,
      `reset()` expose, manual name/email validation)
- [x] **Phase 3 — page wiring**: header flex-wrap row in `site-admin/tenant/index.vue` with the
      modal; `onCreate` → success toast + `navigateTo('/site-admin/tenant/${created.id}')`;
      `30002` → duplicate-name error toast, modal stays open
- [ ] **Phase 4 — verify**: `pnpm build` gate ✅ (13/13, 2026-07-27); manual flow pending —
      create a tenant, land on detail, confirm auto-subscribed license packs + invited admin
      resident; duplicate name → toast, modal stays open

Tenant-detail extension (built 2026-07-27 — contract in `[id].ui.md` / `[id].data.md`; the
cross-tenant pieces of Phases 5–7 were **removed the same day** by the reversal — see Status):
- [x] **Phase 5 — trigger + workflow**: `TriggerWorkflowResult.result: JSON` + parse the
      webhook response; `invite-user.json` → `responseMode: lastNode`, `mode` input, IF-skip of
      Send Email in link mode, final Respond payload nodes (`{ link, template, sent }`).
      ~~Plugin `targetTenantPermission` pass-through~~ — built, then removed (reversal).
- [x] **Phase 6 — client package**: extend `appTenantById.graphql` (residents + licenses,
      subscriptions + pack + counts; `licensePack` inflection confirmed) + codegen; extend
      `useSiteAdminTenant` (`users`, `subscriptions` views) and `useInviteUser`
      (`mode`, shaped `InviteUserResult`); `useTriggerWorkflow` returns `result`.
      ~~`InviteUserInput.targetTenantId`~~ — built, then removed (reversal).
- [x] **Phase 7 — tenant-app**: `[id].vue` users + subscriptions cards (max-w-4xl, read-only);
      the user-invitation U9 send-immediately checkbox on `InviteUserModal`; new
      `SendInviteModal.vue` (send email / copy link — now consumed only by `admin/user/[id]`).
      ~~Invite User modal + per-row Send invite on `[id].vue`; `target-tenant-id` props~~ —
      built, then removed (reversal).
- [ ] **Phase 8 — verify**: `pnpm build` gate ✅ (13/13, 2026-07-27, re-run after the reversal);
      manual pending — `[id]` renders users (license badges) + subscriptions read-only with **no**
      invite affordances; support mode → tenant admin pages handle invites; link mode / U9
      checkbox verified from `admin/user` (see `user-invitation/`)

Admin-identity extension (built 2026-07-30, plan `0650` — contract in `index.ui.md` /
`index.data.md`):
- [x] **Phase 9 — DB**: in-place edit of `00000000010240_app_fn.sql` (house pattern — no
      rework tag; envs rebuild) with `drop function if exists` guards for the old 4-arg
      signatures (overload gotcha), both functions recreated with
      `_first_name`/`_last_name`/`_phone` (defaulted); admin-profile pre-create/blank-fill
      before `invite_user` with the display-name recipe (lowercase first initial + last name →
      lowercased email local part → null)
- [x] **Phase 10 — client package**: `createAppTenant.graphql` extended
      (`$firstName!/$lastName!/$phone` → `_firstName/_lastName/_phone` — inflection confirmed
      via introspection), codegen against the rebuilt API, `useCreateTenant` → object-input
      signature (`CreateTenantInput`)
- [x] **Phase 11 — tenant-app**: `NewTenantModal.vue` first/last/phone fields (`PhoneSegments`
      for phone), payload-object `create` emit (`NewTenantPayload` exported from the SFC);
      page `onCreate` passes the payload through (toast/navigation/30002 handling unchanged)
- [ ] **Phase 12 — verify**: `pnpm build` gate ✅ (13/13, 2026-07-30); manual pending — create
      a tenant with names + phone, confirm the pre-created profile (first/last/phone,
      display_name recipe) and the already-linked admin resident on the detail page; create
      with an **existing** user's email → their profile only blank-filled; phone omitted →
      profile.phone null

## Remaining Open Questions
- ~~Confirm the generated FK field name `licensePack` on `TenantSubscription` (V5 inflection)~~ —
  resolved 2026-07-27: `licensePack?: Maybe<LicensePack>` exists in the generated schema; no
  smart tag needed.

## Considered & rejected
- **Identifier + type fields in the modal** — rejected 2026-07-27 (user directive: always
  `'customer'` here; identifier adds friction with no current need).
- **Storing admin names/phone without DB change** — rejected 2026-07-30: `app.resident` has no
  such columns and no profile exists at invite time; the fields would be collected and dropped.
- **Overwriting an existing profile's fields from the modal** — rejected 2026-07-30 in favor of
  blank-fill only (a super admin must not clobber a user's self-maintained data).
- **Triggering notify phone-verification at creation** — rejected 2026-07-30: the admin hasn't
  even logged in yet; verification (D13) stays a later, user-owned ceremony.
- **Stay on list + re-fetch after create** — rejected in favor of navigating to the new
  tenant's detail page.
- **Adding `jwt.enforce_permission('p:app-admin-super')` to `app_api.create_tenant`** — out of
  scope: the feature must call existing infrastructure unchanged; RLS already enforces the same
  permission. Tracked as a Known Gap in `index.data.md`.
- **Cross-tenant invites via a `targetTenantId` pass-through** — built 2026-07-27, then
  **removed the same day by user directive**: support-mode-first won (see Status Reversal). The
  originally rejected "clunky claims switch" is the deliberate, auditable path — a super admin
  acts inside a tenant only under that tenant's claims.
- **Separate `invite-user-admin` workflow** for cross-tenant invites — rejected 2026-07-27:
  duplicate surface (and moot after the reversal).
- **Copy a plain login URL** (no ZITADEL code) — rejected: the invitee couldn't verify email or
  set a password from it.
- **Subscription deactivate/reactivate row actions** on the detail page — deferred: the
  mutations exist (`p:app-admin-super`) but the page stays an overview for now.
- **Invite button on ACTIVE users** (as a password-reset send via the 409 path) — rejected:
  password reset has its own affordance; keep the button's meaning single.
