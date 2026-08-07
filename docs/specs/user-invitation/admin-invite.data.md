# Admin — Invite User (Data)

## Status
Implemented (Phase 1, verified live 2026-07-22; send-immediately checkbox built 2026-07-27 via
plan `0160` — build gate passed, manual e2e pending). Mirrors the `useSendTest` carve-out
(`notifications/send-test.data.md`) exactly — the invite dispatches through the **existing**
`triggerWorkflow` GraphQL mutation, not a bespoke route or a new DB mutation.

## Send-immediately checkbox — no new data surface

The checkbox (`admin-invite.ui.md`) maps 1:1 onto the **extended invite contract owned by
`../tenant-app/site-admin/tenant/[id].data.md`** (Delta 2 — sync link mode; issue `0160`):

- checked → `invite({ …, mode: 'email' })` — today's behavior (fire the workflow, email #1).
- unchecked → `invite({ …, mode: 'link' })` — the workflow skips Send Email and returns
  `{ link, template, sent: false }`; the composable shapes it into `InviteUserResult.link`,
  which the modal displays.
- The localStorage persistence (`invite-user-send-immediately`) is a **UI-only** concern —
  nothing here changes for it.

This file adds **zero** contract of its own: `InviteUserInput.mode` / `InviteUserResult` are
specified once, in the site-admin extension. Until those deltas land, unchecked/link mode cannot
work — build them first or together.

## Send path — `triggerWorkflow` carve-out

```
triggerWorkflow(workflowKey: "invite-user",
  inputData: { email, firstName?, lastName?, displayName?, phone?, mode? })   // U10: +4 optional fields
  → { accepted, runId }        // fire-and-forget (email mode); the email + resident row are the evidence
```

The four new optional fields (`firstName`, `lastName`, `displayName`, `phone`) ride the **same
`inputData` bag** — the `triggerWorkflow` plugin forwards arbitrary keys, so **no plugin/registry
change** is needed (only the existing `invite-user` → `p:app-admin` gate applies). They feed
`app_fn.invite_user`'s new profile params (`_shared.data.md` U10).

- The plugin injects `tenantId`/`profileId` from the caller's claims and enforces `p:app-admin`
  (registry entry, `_shared.data.md`). No client-side tenant/profile is sent.
- **No new DB mutation surface** — the resident is created inside the workflow (`app_fn.invite_user`
  as `n8n_worker`), consistent with `send-notification`: nothing the client can call directly forges
  a resident or an invite email.

## Composable (R1)

Real implementation in `packages/graphql-client-api/src/composables/useInviteUser.ts`, thin
re-export at `apps/tenant-app/app/composables/useInviteUser.ts`.

```ts
// packages/graphql-client-api/src/composables/useInviteUser.ts (shape — U10)
// email required; firstName/lastName/displayName/phone optional; mode optional (link/email).
export interface InviteUserInput {
  email: string
  firstName?: string
  lastName?: string
  displayName?: string
  phone?: string
  mode?: 'email' | 'link'
}
```

The live implementation builds the `inputData` bag from the supplied fields (dropping/blanking
empties) and returns `InviteUserResult` (`{ accepted, link, template }`) — see the current file
`packages/graphql-client-api/src/composables/useInviteUser.ts`. U10 only widens `InviteUserInput`
(makes `displayName` optional, adds `firstName`/`lastName`/`phone`) and forwards the four new keys
into the existing `triggerWorkflow('invite-user', …)` call; the result-shaping (link/email mode) is
unchanged.

```ts
// apps/tenant-app/app/composables/useInviteUser.ts
export { useInviteUser } from '@function-bucket/graphql-client-api'
```

- Reuses the existing `TriggerWorkflow` mutation document/hook — **no new `.graphql` file** unless
  one is not already generated for `useSendTest`; if present, import the same generated hook.
- Return shape: just `{ invite }` (an imperative action). No query/`fetching` here.
- Error mapping for the toast (`admin-invite.ui.md`): urql `CombinedError` →
  `res.error.graphQLErrors[0]?.message`; the plugin throws `30000: NOT AUTHORIZED` (missing
  `p:app-admin`) and `401: not authenticated` — map both to friendly copy. **U10:** a `31020` match
  → *"That display name is already taken — pick another."* is included **defensively**, but note
  (verified 2026-08-07) n8n masks node errors behind a generic webhook 500, so `31020` does **not**
  reach the client today — a link-mode collision surfaces as `workflow trigger failed: 500`, mapped
  to copy that names both a bad email and a taken display name. See the caveat in `admin-invite.ui.md`.

## Requirements
- `invite-user` registered in `WORKFLOW_REGISTRY` (`p:app-admin`) — `_shared.data.md`.
- The `triggerWorkflow` mutation + generated hook already exist (used by `useSendTest`).

## Open Questions
- [ ] Surface the async nature in the UI (the resident appears a beat later) — v1 accepts it; a
      Phase 4 poll/optimistic-add could smooth it.
