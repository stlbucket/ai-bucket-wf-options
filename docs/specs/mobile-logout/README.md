# mobile-logout — Sign-out affordance in the mobile nav drawer

> **Execution Directive:** plan + build this spec via
> `/fnb-stack-implementor docs/specs/mobile-logout/README.md` —
> the implementor derives the `docs/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
Implemented — 2026-08-07. Decision locked 2026-08-07 (placement = nav drawer footer). Built via
`0690__app_______mobile-logout-home-greeting_____MED__.plan.md`; `pnpm build` gate green (13/13).
UI-only; single file touched (`AppNavMobile.vue`). Pending user rebuild + running-UI verify. No
divergence from the spec.

## Purpose

On a **desktop** viewport the sidebar footer (`AppNav.vue`, `hidden lg:flex`, both the expanded
and icon-rail branches) carries the user identity row **and a Sign-out button**. That sidebar is
not rendered below `lg`, and none of the three mobile surfaces expose logout:

- the slim brand header (`default.vue`, `lg:hidden`) — color-mode, Exit Support, Sign in only;
- the bottom tab bar (`AppNavMobile.vue`) — Home / primary tools / Menu / Profile;
- the nav drawer (`AppNavMobile.vue` `USlideover`) — brand, workspace switcher, sections.

**Result: a logged-in user on mobile has no way to sign out** short of resizing to desktop width.

This change adds a **user footer** to the bottom of the mobile nav drawer (the `USlideover`
`#content`), mirroring the desktop sidebar footer: the identity row (avatar initials + display
name, linking to `/auth/profile`) and a **Sign out** button bound to `useAuth().logout()`. The
drawer is the mobile analogue of the desktop sidebar, so its footer is the natural home for the
same affordance.

Scope is purely the tenant-layer mobile drawer markup. **No DB, no GraphQL, no new types, no new
composable** — `logout` (and the `user` identity + `initials`) already exist on `useAuth()` and
are reused verbatim from `AppNav.vue`.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Placement | **Nav drawer footer** (`AppNavMobile.vue` `USlideover` `#content`), pinned to the bottom via `mt-auto` below the scrolling sections list | User choice (2026-08-07). The drawer is the mobile mirror of the desktop sidebar, whose footer already holds identity + sign-out; keeps logout where the desktop convention puts it. Rejected: slim header (logout is not urgent enough to occupy always-on-screen chrome), bottom tab bar (fixed-slot, a conditional tab shifts navigation). |
| Identity row | Avatar initials chip + `user.displayName`, wrapped in a `NuxtLink` to `/auth/profile` (`:external`), `@click="closeNav"` | Byte-for-byte the desktop expanded footer's identity row (`AppNav.vue`), minus the dark-rail variant. `closeNav` so the drawer dismisses when the user taps through to their profile. |
| Sign-out control | `UButton icon="i-lucide-log-out" variant="ghost" aria-label="Sign out"`, `@click="logout"` | Matches the desktop expanded-footer sign-out button exactly (same icon, ghost variant, white/70 hover on the `bg-blue-900` drawer). `logout` already does the full teardown + redirect, so no local loading state. |
| Initials source | `initials` computed lifted verbatim from `AppNav.vue` (first+last initial of `user.displayName`, `?` fallback) | Single derivation shared with the desktop footer; keep the two in sync (candidate for a tiny shared helper only if a third call site appears — over-abstraction for two today). |
| Visibility gate | Rendered inside the `v-if="isLoggedIn"` `USlideover` — no extra guard | The drawer only mounts when logged in; the footer inherits that gate. |

## Files in this spec

| File | Covers |
|---|---|
| `README.md` | This index |
| `shell.ui.md` | The `AppNavMobile.vue` drawer-footer edit: script additions (`user`, `logout`, `initials`, `closeNav`), the footer markup, placement, and responsiveness |
| `shell.data.md` | The reused data contract — `useAuth().logout()` + the `user` identity surface — pointing at `packages/auth-ui`; no new data work |

## Implementation Task List

### Phase 1 — drawer footer (`AppNavMobile.vue`)
- [x] In `<script setup>`, extend the `useAuth()` destructure to pull `user` and `logout` (today it
      takes only `isLoggedIn`); add the `initials` computed copied from `AppNav.vue`
- [x] In the `USlideover` `#content`, after the scrolling `flex-1` sections `<div>`, add a
      `mt-auto` bordered footer: the identity `NuxtLink` (avatar chip + display name → `/auth/profile`,
      `@click="closeNav"`) and the ghost `i-lucide-log-out` **Sign out** `UButton` (`@click="logout"`)
- [x] Confirm no new imports beyond what `useAuth()` already provides; `UButton`/`UIcon`/`NuxtLink`
      are auto-imported (`computed` was already imported)

### Phase 2 — companion edit: remove the home greeting (`home-app/index.vue`)
Reported in the same pass (2026-08-07); authority is `docs/specs/home-app/index.ui.md`
("Removed from this page — 2026-08-07"). Not mobile-only — the greeting goes at **every** width.
- [x] In `apps/home-app/app/pages/index.vue`, delete the `<h1>hey, {{ firstName }}.</h1>` from the
      logged-in (`v-else`) branch so it renders `HomeNarrative` only
- [x] Remove the now-unused `firstName` computed; drop `user` from the `useAuth()` destructure if
      nothing else on the page uses it (the `session=expired` toast block uses `route`/`router`/
      `toast`, not `user`)
- [x] Update `home-app/index.ui.md` status: the greeting-removal is no longer "specified ahead of
      the code" — reflect it as built

### Phase 3 — verify + spec upkeep
- [x] Layer edits don't hot-reload — ask the user to rebuild; `pnpm build` gate green (13/13)
- [ ] Verify in the running UI at mobile width, logged in: open Menu → footer shows identity +
      Sign out; tapping Sign out logs out and lands on the logged-out home; tapping the identity
      row closes the drawer and opens the profile — **pending user rebuild**
- [ ] Verify the home logged-in view (mobile + desktop) shows the tab strip with no greeting above it
      — **pending user rebuild**
- [x] README status → Implemented; boxes checked; note any divergence (none)

## Remaining Open Questions
- **Shared `initials` / footer with the desktop sidebar** — desktop (`AppNav.vue`) and this drawer
  now both derive `initials` and render an identity + sign-out footer. If a third surface appears,
  extract a shared `<UserNavFooter>`; for two call sites the duplication is cheaper than the
  abstraction. Defer.

## Considered & rejected
- **Slim brand header** (`default.vue`) — always on-screen, but logout is not an urgent affordance
  the way Exit Support is (which won the header in `mobile-exit-support`); the header would crowd
  on narrow phones (brand + color-mode + Exit Support + logout).
- **Bottom tab bar tab** (`AppNavMobile.vue`) — the bar is fixed-slot (Home / primary tools / Menu
  / Profile); a Sign-out tab competes with navigation and shifts the layout.
- **Logout only on the `/auth/profile` page** — reachable via the Profile tab, but buries a common
  action an extra navigation deep and diverges from the desktop sidebar's in-nav placement.
