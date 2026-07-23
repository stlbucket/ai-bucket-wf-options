# OTP Login — Deep-link Creation Surface (Data)

The app-facing (**post-claims**) side: how the platform generates a **tenant-scoped** link to a URN
element. **No recipient argument** (D5 revised 2026-07-22) — the link works for any resident of the
URN's tenant; the recipient is resolved when the opener self-identifies (`_shared.data.md` §7). No
dedicated page — this is a mutation + a demonstration wiring into the existing Todo UI. Shared
schema/functions: `_shared.data.md`.

## Status
Draft — fill in all `[FILL IN]` sections before implementing.

## GraphQL mutation — `createDeepLink`

Two-layer per R8. `app_api` is SECURITY INVOKER + `jwt.enforce_permission`; `app_fn` (§5.6) does the
work SECURITY DEFINER. **Signature carries no resident** — the tenant comes from the URN.

```sql
-- SECURITY INVOKER — gate + delegate
create function app_api.create_deep_link(_subject_urn text)
returns auth.deep_link language plpgsql as $$
begin
  -- ANY-OF gate {p:app-user, p:app-admin} (mirrors the game-event trigger). Admins hold
  -- p:app-admin but NOT the base p:app-user, yet can share an item they can see — a plain
  -- enforce_permission('p:app-user') 30000s the super-admin login. Tenant scoping is the real
  -- guard: parse the tenant from _subject_urn and require jwt.tenant_id() = it.
  perform jwt.enforce_any_permission(array['p:app-user', 'p:app-admin']::citext[]);
  if (split_part(_subject_urn, ':', 3))::uuid <> jwt.tenant_id() then
    raise exception 'SUBJECT_NOT_IN_CURRENT_TENANT';
  end if;
  return app_fn.create_deep_link(_subject_urn, jwt.resident_id());
end;
$$;
```

- Exposed by PostGraphile as mutation `createDeepLink`. `app_api` is already in the exposed-schemas
  list (`graphql-api-pattern.md`); `app_fn` is not (correct — the definer stays closed).
- `.graphql` document: `packages/graphql-client-api/src/graphql/app/mutation/createDeepLink.graphql`
  → generated `useCreateDeepLinkMutation`.
- Returns the created `auth.deep_link` row; the client builds the URL:
  `${authAppUrl}/go/${id}` (`authAppUrl` = `http://localhost:4000/auth`). `[FILL IN]` confirm
  `auth.deep_link` is PostGraphile-visible under RLS (add a claims-gated SELECT policy: creator or
  the target profile's residents can read their own links — deny-all otherwise).

## `subject_label` caching
`app_fn.create_deep_link` caches a human label so the pre-claims landing page shows context without
an RLS read. The sender is authenticated, so the label can be resolved via the module's own read.
`[FILL IN]` — v1 (Todos): read `todo.todo.title` for the subject's id. Generalize later via a
per-module label resolver or a `res` computed field. Keep it best-effort (null label → the landing
page shows "a Todo" from `module` alone).

## Composable
`packages/graphql-client-api/src/composables/useDeepLink.ts` (real impl) + thin re-export
`apps/tenant-app/app/composables/useDeepLink.ts`. **`shareToLink(subjectUrn)`** — no resident arg:

```ts
export function useDeepLink() {
  const { executeMutation } = useCreateDeepLinkMutation()
  // Tenant-scoped quick-login link — works for any resident of the URN's tenant. No recipient.
  async function shareToLink(subjectUrn: string): Promise<string> {
    const res = await executeMutation({ subjectUrn })
    if (res.error) throw res.error
    const id = res.data?.createDeepLink?.deepLink?.id   // [FILL IN] confirm inflected payload shape
    return `${useRuntimeConfig().public.authAppUrl}/go/${id}`
  }
  return { shareToLink }
}
```

## v1 demonstration wiring — Todos
The Todo detail page (`apps/tenant-app/app/pages/tools/todo/[id].vue`) gains a **"Copy quick-login
link"** action, **available on any todo — assigned or not** (D5 revised: no assignee required). The
current gate that requires `tree.owner.residentId` and calls `shareToResident(urn, residentId)` is
**removed** — the link is tenant-scoped, so only the todo's `urn` is needed:
- Builds `subjectUrn` for the todo (`urn:fnb:<tenantId>:todo:todo:<id>` — via `formatUrn`/the row's
  `urn` field already exposed by PostGraphile from the URN registry retrofit).
- Calls `shareToLink(subjectUrn)` → gets the `/auth/go/<id>` URL → copies to clipboard (toast, UC7).
- No "assign this todo first" error path — the button is always enabled once the todo loads.
- **Delivery** for v1 is manual "Copy link" (the sender shares it however they like — the opener will
  self-identify to receive a code). An automatic `todo-shared` notification is a later enhancement,
  but note it would need an explicit recipient again (a *targeted* send), which the tenant-scoped
  link deliberately doesn't carry — so v1's "copy + share manually" is the natural fit. `[FILL IN]`
  confirm the automatic-send follow-on stays out of scope here.

This is the only module wired in v1 (Q1 scope). Polls / approvals repeat this exact shape
(URN registry → `createDeepLink` → `/auth/go` responder) in their own follow-on specs.

## Targeted send — `sendDeepLink` (multi-resident, D14)

Alongside "Copy quick-login link", the item detail gains a **"Send to residents"** button that opens
a modal (UI: `share-link.ui.md`): pick **one or more residents** of the current tenant, type a
**message**, tick **Email** and/or **SMS**, and send. This **reuses the same tenant-scoped link** —
it does not mint a per-recipient link, and it does **not** bypass the OTP: recipients still land on
`/auth/go/<id>` and self-identify (the link is a pointer, never a bearer token — see README
*Considered & rejected*). The send is a **post-claims, claims-gated** action (the sender is an
authenticated resident), delivered through the notify pipeline — **not** the pre-claims root of trust.

### Contract
Cleanest fit is one post-claims mutation that fans out over the notify workflow:

```sql
-- SECURITY INVOKER — gate + delegate (R8)
create function app_api.send_deep_link(
  _subject_urn  text,
  _resident_ids uuid[],
  _message      text,
  _channels     text[]          -- subset of {'email','sms'}
) returns auth.deep_link language plpgsql as $$
begin
  perform jwt.enforce_permission('p:app-user');          -- resident of the URN's tenant (as create_deep_link)
  -- 1. create (or reuse) the tenant-scoped link for _subject_urn (app_fn.create_deep_link)
  -- 2. for each resident_id (MUST be a co-resident of jwt.tenant_id() — enforce; ignore foreign ids)
  --      × each requested channel, resolve that resident's deliverable contact and enqueue a send.
  -- returns the deep_link row so the client can also show/copy the URL.
end;
$$;
```

- **Delivery** rides the existing `send-notification` n8n workflow (R22) via the house
  `triggerWorkflow('send-notification', …)` path — `[FILL IN]` confirm the trigger boundary against
  `.claude/specs/notifications/` (webhook vs registry): one send per (resident × ticked channel),
  template **`deep-link-share`** `[FILL IN]` (vars: `senderName`, `message`, `subjectLabel`, `url`).
  The `url` is `${authAppUrl}/go/<id>` for the one tenant-scoped link.
- **Contact resolution is server-side only** (inside the send flow) — the client never receives
  co-residents' phones/emails. Selecting a resident yields only their **name** (already available in
  the Todo detail's `residents` list).
- **Channel availability:** `email` works today; `sms` requires notify SMS Phase 0/1 (D12) — until
  then the SMS checkbox is disabled (UI) and a stray `sms` request is skipped server-side. A selected
  resident with **no deliverable contact** for a ticked channel (e.g. no verified phone) is **skipped**
  for that channel; the mutation returns a per-recipient delivery summary `[FILL IN]` so the UI can
  toast "sent to N of M".
- **Alternative considered:** client-orchestrated (call `createDeepLink`, then loop
  `triggerWorkflow` per recipient) — rejected for v1: puts recipient-fan-out + contact resolution on
  the client and multiplies round-trips. Keep the fan-out server-side.

### Composable
Extend `useDeepLink`:

```ts
async function sendDeepLink(opts: {
  subjectUrn: string
  residentIds: string[]
  message: string
  channels: ('email' | 'sms')[]
}): Promise<{ url: string; summary: DeliverySummary }> { /* useSendDeepLinkMutation */ }
```

## Open Questions
- [x] `create_deep_link` / `send_deep_link` permission — **resolved:** any-of `{p:app-user,
      p:app-admin}` (admins lack the base `p:app-user`; tenant scoping is the real guard). A
      per-module "can share" refinement is a follow-on.
- [ ] `auth.deep_link` SELECT policy for the GraphQL return (creator + fellow tenant residents? or
      creator-only — there is no single "target resident" now).
- [ ] `subject_label` resolver generalization beyond Todos.
- [ ] `send_deep_link` trigger boundary (webhook vs `triggerWorkflow` registry) + the
      `deep-link-share` template shape — resolve against `.claude/specs/notifications/` at plan time.
- [ ] Per-recipient `DeliverySummary` shape (sent / skipped-no-contact / channel-unavailable) for the
      "sent to N of M" toast.
- [ ] `send_deep_link` permission: `p:app-user` of the tenant vs a per-module "can share" refinement
      (same open question as `create_deep_link`).
