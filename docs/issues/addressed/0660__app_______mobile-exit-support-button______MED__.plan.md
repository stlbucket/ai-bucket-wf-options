# Plan: Mobile Exit Support — add the affordance to the mobile brand header

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> Small, UI-only fix in `tenant-layer`; no DB, no GraphQL, no new types. Spec:
> `docs/specs/mobile-exit-support/` (README + `shell.ui.md` + `shell.data.md`). Support-mode
> background: `docs/specs/architecture-considerations/read-these/e2-support-mode-detection.md`.

**Severity: MED** (a support user on a mobile viewport cannot leave support mode — the only
exit affordance is in the desktop-only sidebar) · Category: app · Identified: 2026-08-03
(user report: "on the mobile UI, there is no exit support button")

## Context

The "Exit Support" affordance lives in `AppNav.vue`'s user footer
(`packages/tenant-layer/app/components/AppNav.vue`, both the expanded and icon-rail branches).
That sidebar is `hidden lg:flex` — it does not render below `lg`. The three mobile surfaces
(the slim brand header in the tenant-layer `default.vue` layout, the bottom tab bar, and the
nav drawer — all `lg:hidden` via `AppNavMobile.vue`) expose **no** Exit Support button. A user
who entered support mode on a phone is stuck in it.

Detection and the exit action already exist and are reused verbatim:
`isInSupportMode = user.value?.permissions?.includes('p:exit-support')` and
`useAuth().exitSupport()` (`packages/auth-ui/src/use-auth.ts`).

## Fix approach

Add the desktop button to the **slim mobile brand header** in
`packages/tenant-layer/app/layouts/default.vue` (user-chosen placement, 2026-08-03), gated on
`isInSupportMode`, as the first child of the header's `ml-auto` action cluster (before
`UColorModeButton`). Byte-for-byte the `AppNav.vue` expanded-footer button
(`size="xs" color="warning" variant="soft" icon="i-lucide-log-out"`, label "Exit Support"),
minus the desktop-only `ml-1`.

### Phase 1 — mobile header button (`default.vue`)
- Extend the existing `useAuth()` destructure from `{ isLoggedIn }` to
  `{ isLoggedIn, user, exitSupport }`; add
  `const isInSupportMode = computed(() => user.value?.permissions?.includes('p:exit-support'))`
  (import `computed` from `vue`).
- Insert the `UButton` (`v-if="isInSupportMode"`, `@click="exitSupport"`) at the top of the
  `ml-auto` cluster. Exact markup in `docs/specs/mobile-exit-support/shell.ui.md`.
- No new imports beyond `computed`; `UButton` is auto-imported; `i-lucide-log-out` is in use.

### Phase 2 — verify + spec upkeep
- Layer edits don't hot-reload — **ask the user to rebuild**; then `pnpm build` gate green.
- Verify read-only in the running UI at a mobile width, in support mode: button visible; tap
  exits support mode and lands home; button absent when not in support mode; desktop `lg`+
  unchanged (no duplicate — header is `lg:hidden`, sidebar is `hidden lg:flex`).
- Flip the spec (`docs/specs/mobile-exit-support/` README + `shell.ui.md` + `shell.data.md`)
  status → `Implemented`; check the README task-list boxes; record any divergence.

## Verification

- `pnpm build` gate green (repo-wide `pnpm lint` is known-broken — do not gate on it).
- Manual, mobile-width, support-mode round trip as above (user-run rebuild first — never
  rebuild/restart the env yourself).

## Completion

Ask the user (AskUserQuestion): move this plan to `addressed/`?
