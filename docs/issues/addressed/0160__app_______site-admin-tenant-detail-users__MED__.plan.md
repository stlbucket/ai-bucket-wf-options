# Site-admin tenant detail — users, subscriptions, cross-tenant invites

> **Execution Directive:** execute this plan via `/fnb-stack-implementor <this-file>`.
> Spec: `.claude/specs/tenant-app/site-admin/tenant/README.md` (+ `[id].ui.md` / `[id].data.md`;
> invite-contract deltas extend `.claude/specs/user-invitation/`). All decisions locked —
> no `[FILL IN]`s.

**Severity:** MED · **Category:** app · **Created:** 2026-07-27

## REVERSAL (2026-07-27, user directive — applied same day)

> "the super admin should NOT be able to add users to a tenant — rather they should enter
> support mode and do it from there." Both invite affordances were **fully removed** after
> being built:
> - `[id].vue`: Invite User modal + per-row Send invite action + `SendInviteModal` instance
>   removed; Users/Subscriptions cards remain **read-only** (empty state now points at support
>   mode).
> - Plugin: the whole `targetTenantPermission`/`targetTenantId` pass-through removed —
>   `tenantId` is always stamped from claims; `'invite-user': { permission: 'p:app-admin' }`.
> - `useInviteUser`: `InviteUserInput.targetTenantId` removed. `InviteUserModal` /
>   `SendInviteModal`: `targetTenantId` props removed (`SendInviteModal`'s only consumer is now
>   `admin/user/[id]` Resend invitation).
> - **Kept:** link mode + `TriggerWorkflowResult.result` (tenant-admin resend + U9 checkbox),
>   `AppTenantById` extension, `users`/`subscriptions` views, U9 send-immediately checkbox.
> - Specs updated (site-admin/tenant README + `[id].ui/.data`, site-admin `_shared.data.md`,
>   user-invitation README + workflow.md); `pnpm build` re-run green 13/13 after the removal.
> - The Phase-4 manual item about cross-tenant invites is **moot**; remaining manual checks are
>   the user's own walkthrough (accepted at filing).

## Goal

Turn `/tenant/site-admin/tenant/[id]` into a full management view: a **Users card** (every
resident of the viewed tenant with status badge, active license-type badges, and — on `INVITED`
rows — a **Send invite** popup offering *Send email* / *Copy link*), a read-only
**Subscriptions card**, and an **Invite User** modal that creates users in the *viewed* tenant.
**Zero DB work** (super-admin cross-tenant read RLS already exists; resident creation stays in
`app_fn.invite_user` via the live `invite-user` n8n workflow). The work is: two invite-contract
deltas (plugin `targetTenantId` pass-through + workflow sync link mode), a query extension +
codegen, composable extensions, and the page/components.

**Extended 2026-07-27 (folded in per R23):** also delivers user-invitation **Phase 5 / U9** —
the **"Send invite immediately" checkbox** on `InviteUserModal` (spec:
`.claude/specs/user-invitation/admin-invite.ui.md` + `admin-invite.data.md`, README U9). It
rides this plan's link mode: checked → `mode: 'email'` (today's behavior), unchecked →
`mode: 'link'` with an in-modal copyable ceremony URL; the default is remembered in
localStorage `invite-user-send-immediately`, written on successful submit only. See Phase 3b.

## Verified code anchors (checked 2026-07-27)

| Anchor | Fact |
|---|---|
| `db/fnb-app/deploy/00000000010250_app_policies.sql:58,90,106` | `p:app-admin-super` read policies on `app.resident` / `app.tenant_subscription` / `app.license` — cross-tenant reads are pure RLS, no DDL |
| `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts:14,32` | `WORKFLOW_REGISTRY: Record<string, { permission: … }>`; `'invite-user': { permission: 'p:app-admin' }` |
| `trigger-workflow.plugin.ts:102-106` | `body = { ...(inputData ?? {}), tenantId: claims.tenantId, profileId: claims.profileId }` — claims stamp overwrites any client `tenantId`; the pass-through hooks in here |
| `trigger-workflow.plugin.ts:63-70,121-122` | SDL `TriggerWorkflowResult { accepted, runId }`; lambda returns `{ accepted: response.ok, runId: null }` ignoring the response body — extend both with `result: JSON` |
| `n8n/workflows/invite-user.json` | Nodes `Webhook (responseMode: onReceived)` → `Create Resident` (`app_fn.invite_user($1,$2)` from `body.tenantId`/`body.email`) → `Invite Via ZITADEL` (Code) → `Send Email` (HTTP → `webhook/send-notification`) |
| `invite-user.json` Code node (tail) | Already builds `vars.verifyUrl` (create) / `vars.setPasswordUrl` (409 re-invite) + `templateKey` — link mode only needs to surface these in a respond payload, no new ZITADEL logic |
| `packages/graphql-client-api/src/graphql/n8n/mutation/triggerWorkflow.graphql` | The mutation doc to extend with `result` |
| `packages/graphql-client-api/src/composables/useTriggerWorkflow.ts` | `TriggerWorkflowResult { accepted, runId }` interface + `triggerWorkflow()` — add `result` |
| `packages/graphql-client-api/src/composables/useInviteUser.ts` | `InviteUserInput { displayName, email }`; `invite()` → `triggerWorkflow('invite-user', …)` — extend with `targetTenantId` / `mode` |
| `packages/graphql-client-api/src/graphql/app/query/appTenantById.graphql` | Currently `residents { totalCount }` + `tenantSubscriptionsList { ...TenantSubscription licenses { totalCount } }` — replace count with full resident list |
| `src/graphql/app/query/residentById.graphql` | Nesting precedent: `licenses: licensesList { ...License }` under a resident |
| `src/generated/fnb-graphql-api.ts:2931` | `licensePack?: Maybe<LicensePack>` exists on the subscription type — the spec's open question is **resolved**, no smart tag needed |
| `src/composables/useSiteAdminTenants.ts:31-76` | `useSiteAdminTenant(id)` — returns `{ data, fetching, error, refresh, activate, deactivate, update }`; extend with `users` / `subscriptions` computeds; barrel already exports the file |
| `apps/tenant-app/app/components/InviteUserModal.vue` | Self-contained trigger + modal, `useInviteUser().invite({ displayName, email })` — add optional `targetTenantId` prop + `invited` emit |
| `apps/tenant-app/app/pages/site-admin/tenant/[id].vue` | Page to extend — `max-w-2xl` single detail card today; uses `statusColor('tenant', …)` |
| `packages/auth-layer/app/utils/status.ts:61-68,82-85` | `statusColor` maps for `resident` + `subscription` already exist (UC1 — no new mappings) |
| `apps/tenant-app/nuxt.config.ts:33` | `'/site-admin/**': { ssr: false }` — UC14 already covered |
| Resident statuses arrive UPPERCASE (`'INVITED'`) via the GraphQL enum | gate the Send-invite button on `status === 'INVITED'`; `statusColor` normalizes case |

## Phases

### Phase 1 — trigger plugin + workflow (the two invite-contract deltas)
- [x] `trigger-workflow.plugin.ts`: widen the registry value type to
      `{ permission: string | string[] | null; targetTenantPermission?: string }` and set
      `'invite-user': { permission: 'p:app-admin', targetTenantPermission: 'p:app-admin-super' }`.
      In the lambda, before building `body`: if `inputData?.targetTenantId` is present —
      entry has no `targetTenantPermission` **or** caller lacks it → `throw new Error('30000: NOT
      AUTHORIZED')`; else use it as the forwarded `tenantId`. Always delete `targetTenantId` from
      the spread payload. `profileId` stamping unchanged.
- [x] Same file: SDL `TriggerWorkflowResult` gains `result: JSON`; after the fetch, best-effort
      `await response.json()` (try/catch → `null`) and return
      `{ accepted: response.ok, runId: null, result }`. (Fire-and-forget workflows return n8n's
      "Workflow was started" blob — callers ignore it.)
- [x] `n8n/workflows/invite-user.json`: Webhook `responseMode` → `lastNode`; the Code node
      already receives `body.mode` via the webhook item — after `Invite Via ZITADEL`, add an
      **IF** node on `mode === 'link'`: true-branch → new **Respond Payload** Code node
      (`{ link: vars.verifyUrl ?? vars.setPasswordUrl ?? null, template: templateKey,
      sent: false }`); false-branch → existing `Send Email` node → a second Respond Payload
      (`{ link: null, template: templateKey, sent: true }`). Last node's first-entry JSON is the
      webhook response (n8n `lastNode` semantics). Keep the header-auth credential untouched.
      (Definitions are code — edit the JSON; it imports at next `n8n-import` run, which the
      **user** triggers via env restart. Never restart the env in this session.)

### Phase 2 — graphql-client-api (docs + codegen + composables)
- [x] `appTenantById.graphql`: replace `residents { totalCount }` with
      `residents: residentsList(orderBy: [CREATED_AT_ASC]) { ...Resident licenses: licensesList
      { id licenseTypeKey status } }`; extend `tenantSubscriptions` with
      `licensePack { displayName }` (keep `licenses { totalCount }`).
- [x] `n8n/mutation/triggerWorkflow.graphql`: add `result` to the selection.
- [x] Codegen: `pnpm -F @function-bucket/fnb-graphql-client-api generate` — requires the running
      graphql-api-app to serve the Phase-1 SDL (`result: JSON`). Nuxt dev hot-reloads the plugin;
      if the introspected schema lacks `result`, **stop and ask the user** to restart — never
      restart the env yourself.
- [x] `useTriggerWorkflow.ts`: `TriggerWorkflowResult` gains `result: unknown | null`; select +
      return it.
- [x] `useInviteUser.ts`: `InviteUserInput` gains `targetTenantId?: string` and
      `mode?: 'email' | 'link'`; add `export interface InviteUserResult { accepted: boolean;
      link: string | null; template: 'user-invitation' | 'set-password' | null }`; `invite()`
      forwards the new fields and shapes `res.result` (defensively — non-object → nulls).
- [x] `useSiteAdminTenants.ts` (`useSiteAdminTenant`): add view types (R4)
      `TenantUserView { residentId, profileId, displayName, email, status, type,
      licenseTypeKeys: string[] }` and `TenantSubscriptionView { id, licensePackKey, displayName,
      status, licenseCount }`; add `users` computed (filter `type !== 'SUPPORT'`, active licenses
      → `licenseTypeKeys`) and `subscriptions` computed; return both. No barrel edits (both
      composable files already exported).
- [x] `pnpm -F @function-bucket/fnb-graphql-client-api build` — clean.

### Phase 3 — tenant-app (page + components)
- [x] `InviteUserModal.vue`: add optional `targetTenantId` prop (passed into `invite()`), emit
      `invited` after the success toast. Existing tenant-admin usage unchanged (prop absent).
- [x] New `apps/tenant-app/app/components/SendInviteModal.vue` (per `[id].ui.md`): props
      `{ resident: { displayName: string | null; email: string }, targetTenantId: string }`,
      `v-model:open`; two actions — **Send email** (`invite({ …, mode: 'email' })` → toast,
      close) and **Copy link** (`invite({ …, mode: 'link' })` →
      `navigator.clipboard.writeText(link)` + readonly `UInput` fallback showing the URL +
      toast); per-button loading; error toast keeps it open; muted single-use security caption.
- [x] `[id].vue`: container → `max-w-4xl`; add Users card (header count + `InviteUserModal
      :target-tenant-id="tenant.id"` with `@invited="refresh"`; `UTable` v4 API
      (`TableColumn`, `row.original`, `overflow-x-auto`, `UEmpty` when none) — columns User /
      Status (`statusColor('resident', …)`) / Licenses (badge per key) / Actions (Send invite
      when `status === 'INVITED'` → `SendInviteModal`); add read-only Subscriptions card
      (pack displayName ?? key, `statusColor('subscription', …)`, license count).

### Phase 3b — send-immediately checkbox (user-invitation Phase 5 / U9, folded in 2026-07-27)
Depends on Phases 1–2 (link mode + `useInviteUser` `mode`/`InviteUserResult`). Spec:
`user-invitation/admin-invite.ui.md` (+ `admin-invite.data.md`).
- [x] `InviteUserModal.vue`: add a "Send invite immediately" `UCheckbox`; submit label follows it
      (**Send invitation** / **Create invite link**); unchecked → `invite({ …, mode: 'link' })` →
      swap the form for a link view (readonly `UInput` + copy `UButton` `i-lucide-copy` +
      single-use muted caption + **Done** button); checked → unchanged email path.
- [x] Persistence: localStorage `invite-user-send-immediately` (`'true' | 'false'`), **written on
      successful submit only**, read client-side on setup (`import.meta.client`), missing → `true`.
- [x] `invited` emit fires on both modes (the site-admin page refreshes either way).

### Phase 4 — verify (read-only; never restart the env — ask the user)
- [x] `pnpm build` (turbo) — the repo gate; zero TS errors.
- [x] Sync spec: check off README task-list Phases 5–8; flip `[id].ui.md` / `[id].data.md` /
      README status lines to Implemented (manual e2e pending); resolve the `licensePack` open
      question (confirmed in generated schema). Also sync `user-invitation/`: check off README
      Phase 5 + flip `admin-invite.ui.md`/`admin-invite.data.md` extension status.
- [ ] Manual (Phase 3b): invite with the box unchecked → no Mailpit mail, working ceremony link
      shown in-modal; re-open the modal → checkbox remembers the last-used value; checked path
      unchanged (mail lands, modal closes).
- [ ] Manual (user-run env; needs a restart for the n8n re-import — user runs it): as super
      admin on `/site-admin/tenant/{id}` of a **foreign** tenant — users + license badges +
      subscriptions render; Invite User lands an `INVITED` resident in *that* tenant (not the
      anchor) + `user-invitation` mail in Mailpit; row Send invite → *Send email* re-sends
      (409 path → `set-password` mail); *Copy link* puts a working ceremony URL on the
      clipboard (completes verify-email → set-password) with **no** mail sent; a tenant admin
      (no `p:app-admin-super`) triggering `invite-user` with `targetTenantId` gets NOT
      AUTHORIZED.
