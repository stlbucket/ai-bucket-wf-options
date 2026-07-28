# site-admin/tenant — Tenant List + Detail (+ New Tenant modal)

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
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
| Modal fields | Name + admin email only | User directive 2026-07-27: "this will always be a 'customer' tenant in this context" — type stays the DB default `'customer'`, identifier stays `null`. Keeps the existing `createAppTenant.graphql` doc usable unchanged. |
| Tenant type select | Not offered | Same directive. Root-creatable alternatives (demo/test/trial) can be added later by extending the mutation doc. |
| Admin email required in the form | Yes | The SQL param is nullable but `app_fn.invite_user` inserts an `app.resident` row from it — a null email fails at the DB. The mutation doc already declares `$email: String!`. |
| Post-create behavior | Navigate to `/site-admin/tenant/{id}` | User choice 2026-07-27 — land on the detail page to review subscriptions + the invited admin. No list re-fetch needed. |
| DB changes | None | The button "calls the existing infrastructure" — `app_api.create_tenant` as-is. The missing `jwt.enforce_permission` gate is recorded as a Known Gap (RLS `manage_tenant` already enforces `p:app-admin-super`), not fixed here. |
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

## Remaining Open Questions
- ~~Confirm the generated FK field name `licensePack` on `TenantSubscription` (V5 inflection)~~ —
  resolved 2026-07-27: `licensePack?: Maybe<LicensePack>` exists in the generated schema; no
  smart tag needed.

## Considered & rejected
- **Identifier + type fields in the modal** — rejected 2026-07-27 (user directive: always
  `'customer'` here; identifier adds friction with no current need).
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
