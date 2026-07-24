# Plan: Poll OTP deep-link share (Phase 6 of the poll module — gated)

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>` **only once
> `.claude/specs/otp-login/` has shipped** (it provides `useDeepLink` / `createDeepLink` /
> `sendDeepLink` and the `/auth/go/<id>` responder). Authoritative specs:
> `.claude/specs/tenant-app/tools/poll/` (§9 of `_shared.data.md`, `[id].data.md` → OTP) +
> `.claude/specs/otp-login/`. Never run `git`.

**Severity: LOW** (small, additive) · Workstream: auth-app + tenant-app · Blocked-on:
`0510__auth______otp-login-deep-link` (otp-login) · Split out of
`0380__app_______tenant-polls` (Phases 1–5 shipped 2026-07-23, in `addressed/`).

## Context

The poll module (Phases 1–5) shipped without the "same OTP options as todo" share, because the
otp-login machinery it reuses is still `Draft`. Polls are a URN entity (`poll.poll` → `res.resource`),
so they slot into otp-login's `resolveUrnRoute` exactly like todos. This plan wires that in when
otp-login is live.

## Tasks
- [ ] `apps/auth-app/server/utils/urn-route.ts` — add `poll: (id) => '/tenant/tools/poll/${id}'`
      to the `ROUTES` map (this one-liner is safe to land even before otp-login ships — an opened
      poll deep-link then resolves to the detail page).
- [ ] `apps/tenant-app/app/pages/tools/poll/[id].vue` — in the `canAdmin` action cluster (there is
      a placeholder comment there today), add **"Copy quick-login link"** → `useDeepLink().shareToLink(poll.urn)`
      and **"Send to residents"** → the otp-login send modal (`sendDeepLink(poll.urn, residentIds,
      message, channels)`). Reuse the todo share components/composable verbatim; only the subject
      URN changes.
- [ ] Verify: create a poll, copy its link, open it logged-out → OTP responder lands on the poll in
      the right workspace. `pnpm build` green.

## Docs to update when this ships (R21)
- `otp-login/README.md` — move "Group polls" from the deferred-ideas list to implemented; note the
  `poll` `resolveUrnRoute` entry.
- `.claude/specs/tenant-app/tools/poll/README.md` — flip the Phase 6 line to done.
