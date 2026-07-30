# Plan: Poll OTP deep-link share (Phase 6 of the poll module — UNBLOCKED)

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The otp-login gate is **lifted** (shipped in code 2026-07-22; confirmed 2026-07-28) —
> `useDeepLink` / `shareToLink` / `sendDeepLink`, `/auth/go/[id]`, and the `send-deep-link` n8n
> workflow are live (the todo detail page is the working reference). Authoritative specs:
> `.claude/specs/tenant-app/tools/poll/` (README Phase 6 + D17/D18, `_shared.data.md` §9,
> `[id].ui.md` Header, `[id].data.md` → OTP) + `.claude/specs/otp-login/`. Never run `git`.

**Severity: LOW** (small, additive; no DB work, no codegen) · Workstream: auth-app + tenant-app +
graphql-client-api · ~~Blocked-on `0510__auth______otp-login-deep-link`~~ **shipped** (in
`addressed/`). Split out of `0380__app_______tenant-polls` (Phases 1–5 shipped 2026-07-23).
Re-derived 2026-07-28 against the spec's D17/D18 (supersedes the earlier admin-cluster draft of
this plan).

## Context

The poll module shipped without the "same OTP options as todo" share because otp-login was still
Draft. It has since shipped: `auth.deep_link`/`auth.otp_login` (`00000000010295_otp_login`), the
`/auth/go/[id]` landing + `otp/*` endpoints, `useDeepLink`
(`packages/graphql-client-api/src/composables/useDeepLink.ts`), and the `send-deep-link` n8n
workflow — all exercised daily by the todo surface (`apps/tenant-app/app/pages/tools/todo/[id].vue`
lines 108–125 + `TodoShareModal`). Polls are a URN entity (`poll.poll` → `res.resource`), so they
slot into `resolveUrnRoute` exactly like todos.

Locked decisions (poll README, user choices 2026-07-28):
- **D17** — promote `TodoShareModal.vue` → generic **`ShareModal.vue`** (rename only; props
  `subjectUrn`/`subjectLabel`/`residents` are already generic). Sole consumer today:
  `apps/tenant-app/app/pages/tools/todo/[id].vue`.
- **D18** — poll share cluster renders for **any member**, **published only**
  (`status === 'OPEN' | 'CLOSED'`); no share on drafts.

## Tasks (all done 2026-07-28)

- [x] **URN route** — `apps/auth-app/server/utils/urn-route.ts`: `poll` entry added to `ROUTES`
      (no resolver refactor).
- [x] **Residents on the composable** — `usePollDetail.ts` exposes a `residents` computed via
      `useActiveTenantResidentsQuery()` (useTodoDetail pattern). Package build green.
- [x] **D17 rename** — `TodoShareModal.vue` → `ShareModal.vue` (header comment notes it's the
      shared surface); sole usage in `tools/todo/[id].vue` updated. No spec named the component,
      so no spec-side rename was needed.
- [x] **Poll share cluster** — `tools/poll/[id].vue`: placeholder replaced; header actions now one
      cluster — admin controls in a `v-if="canAdmin"` template, share buttons in a
      `v-if="isOpen || isClosed"` template (D18): `onCopyLink` (shareToLink → clipboard + toast)
      + `<ShareModal>`.
- [x] **Build + verify** — `pnpm build` 13/13 green. User-verified E2E: copy link on the published
      "mexican food" poll → `/auth/go/<id>` → self-identify `large-tenant-01-admin@example.com` →
      OTP via Mailpit → landed on the poll.

## Verification finding (2026-07-28) → follow-on issue

A subtree member (`large-tenant-01-floater@example.com`, active in `WS 4-10`, a descendant of the
poll's tenant `ORG 1-1`) got no OTP email. **Correct per current design** — enumeration-safe
exact-tenant matching (otp-login D13), consistent with the exact-tenant RLS fence (they can't see
the poll via normal login either) — but it contradicts `/tenant/admin/user`'s subtree rollup,
which presents them as this org's people. Filed as
`0620__auth______subtree-deep-link-response____MED__.plan.md` (design-first, affects todo links
identically).

## Docs updated (R21, done 2026-07-28)

- [x] `.claude/specs/tenant-app/tools/poll/README.md` — Phase 6 boxes checked; status flipped to
      Implemented (+ 0620 follow-on noted); `[id].ui.md`/`[id].data.md`/`_shared.data.md` status
      lines updated.
- [x] `otp-login/README.md` — stale `Draft` status replaced with "Shipped in code" (task list
      flagged as not retro-checked — for a spec-reconcile pass); "Group polls" moved to
      implemented with the ShareModal promotion noted.
- [x] `share-link.*` / todo specs — no `TodoShareModal` references existed; nothing to rename.
