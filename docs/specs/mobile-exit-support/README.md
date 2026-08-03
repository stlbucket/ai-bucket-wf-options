# mobile-exit-support — Exit Support affordance in the mobile shell

> **Execution Directive:** plan + build this spec via
> `/fnb-stack-implementor docs/specs/mobile-exit-support/README.md` —
> the implementor derives the `docs/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
Implemented — 2026-08-03. Decision locked 2026-08-03 (placement = slim mobile brand header).
Built via `0660__app_______mobile-exit-support-button______MED__.plan.md`; `pnpm build` gate
green (13/13); verified in the running UI by the user after env rebuild (button visible in
support mode at mobile width). No divergence from the spec.

## Purpose

A support user on a **desktop** viewport gets an "Exit Support" button in the sidebar footer
(`AppNav.vue`, both the expanded and icon-rail branches). That sidebar is `hidden lg:flex`, so on a
**mobile** viewport it is not rendered at all — and none of the three mobile surfaces (the slim
brand header in the tenant-layer `default.vue` layout, the bottom tab bar, or the nav drawer, all
`lg:hidden`) expose an Exit Support affordance. **Result: a support user on mobile has no way to
leave support mode** short of resizing to desktop width or clearing the session.

This change adds the same warning-colored "Exit Support" button to the **slim mobile brand
header** (`packages/tenant-layer/app/layouts/default.vue`), shown only while
`isInSupportMode`, so the affordance is always on-screen on mobile — mirroring the desktop
sidebar's "always visible" intent (support-mode note
`docs/specs/architecture-considerations/read-these/e2-support-mode-detection.md`).

Scope is purely the tenant-layer mobile shell markup + the support-mode computed. **No DB, no
GraphQL, no new types, no new composable** — detection (`p:exit-support` permission) and the exit
action (`useAuth().exitSupport()`) already exist and are reused verbatim from `AppNav.vue`.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Placement | **Slim mobile brand header** (`default.vue`), in the existing `ml-auto` right-hand action cluster, leftmost (before `UColorModeButton`) | User choice (2026-08-03). Always on-screen without opening a menu; closest analogue to the desktop sidebar-footer button; no new vertical space (rejected banner) and not hidden behind a Menu tap (rejected drawer). |
| Detection | `isInSupportMode = user.value?.permissions?.includes('p:exit-support')` | Reuse the exact predicate from `AppNav.vue` / `UserProfileStatus.vue` / the e2 note. Single source of truth for "am I a support resident". |
| Exit action | `useAuth().exitSupport()` bound to `@click`, no local loading state | Matches `AppNav.vue` (its buttons call `exitSupport` directly). `exitSupport` ends with `goHome()` — a full external navigation/reload — so a per-button spinner is moot. |
| Button style | `size="xs" color="warning" variant="soft" icon="i-lucide-log-out"`, label **"Exit Support"** | Byte-for-byte the desktop expanded-nav button (`AppNav.vue`); `warning`/`soft` reads correctly on the `bg-blue-900` header (same background the desktop button sits on). `i-lucide-log-out` is an existing in-repo icon. |
| Visibility gate | `v-if="isInSupportMode"` only — independent of `isLoggedIn` (support mode implies logged in) | The permission is only present for an active support resident; no need to also guard on login. |

## Files in this spec

| File | Covers |
|---|---|
| `README.md` | This index |
| `shell.ui.md` | The `default.vue` mobile-header edit: script additions (`user`, `exitSupport`, `isInSupportMode`), the button markup, placement, and responsiveness |
| `shell.data.md` | The reused data contract — `p:exit-support` detection + the `exitSupport()` flow — pointing at `useAuth()` and the e2 note (no new data work) |

## Implementation Task List

### Phase 1 — mobile header button (`default.vue`)
- [x] In the `<script setup>`, destructure `user`, `exitSupport` from `useAuth()` (alongside the
      existing `isLoggedIn`) and add `const isInSupportMode = computed(() => user.value?.permissions?.includes('p:exit-support'))`
- [x] In the mobile header's `ml-auto` cluster, add the warning "Exit Support" `UButton`
      (`v-if="isInSupportMode"`, `@click="exitSupport"`), placed before the `UColorModeButton`
- [x] Confirm no new imports beyond `computed` (from `vue`); `UButton` is auto-imported

### Phase 2 — verify + spec upkeep
- [x] Layer edits don't hot-reload — ask the user to rebuild; `pnpm build` gate green (13/13)
- [x] Verify in the running UI at a mobile width, in support mode: button visible, tapping it
      exits support mode and lands home; button absent when not in support mode — user-confirmed
      after env rebuild
- [x] README status → Implemented (code + build); boxes checked; no divergence
- [x] Refresh the e2 note's "Where the Exit Support Button Lives" section to name the current
      desktop home (`AppNav.vue`) + this new mobile home — done in this spec pass

## Remaining Open Questions
- **Header width on the narrowest phones** — brand wordmark + "Exit Support" + color-mode may
  crowd below ~360px. If it wraps or clips in verification, fall back to an icon-only button with
  an `aria-label="Exit Support"` (the desktop icon-rail precedent). Defer until observed.

## Considered & rejected
- **Full-width warning banner** (OtpSessionBanner-style) at the top of `<main>` — strongest
  "support mode" signal but eats vertical space on every page; user chose the header button.
- **Nav drawer footer** (`AppNavMobile.vue` `USlideover`) — mirrors desktop's "in the nav"
  placement but is hidden behind a Menu tap, poor for an affordance you want to reach quickly.
- **Adding an Exit tab to the bottom tab bar** — the bar is fixed-slot (Home / primary tools /
  Menu / Profile); a conditional tab shifts the layout and competes with navigation.
- **New shared `<ExitSupportButton>` component reused by desktop + mobile** — worth doing if a
  third surface appears, but for one more call site it is over-abstraction; the markup is five
  lines and already duplicated once in `AppNav.vue`'s two branches.
