# Plan: Mobile logout footer + remove the home greeting

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> Small, UI-only change in `tenant-layer` + `home-app`; no DB, no GraphQL, no new types. Specs:
> `docs/specs/mobile-logout/` (README + `shell.ui.md` + `shell.data.md`) for the logout footer;
> `docs/specs/home-app/index.ui.md` ("Removed from this page — 2026-08-07") for the greeting.

**Severity: MED** (a logged-in user on a mobile viewport has no way to sign out — the only
logout affordance is in the desktop-only sidebar) · Category: app · Identified: 2026-08-07
(user report: "on mobile, there is no logout button" + "get rid of the greeting altogether")

## Context

Two issues reported together, both pure UI-shell:

1. **No mobile logout.** The Sign-out button lives in `AppNav.vue`'s user footer
   (`packages/tenant-layer/app/components/AppNav.vue`, both branches). That sidebar is
   `hidden lg:flex` — not rendered below `lg`. None of the three mobile surfaces (slim brand
   header in `default.vue`, the bottom tab bar, the nav drawer — all `lg:hidden` via
   `AppNavMobile.vue`) expose logout. A user who signed in on a phone cannot sign out.
2. **Home greeting.** `apps/home-app/app/pages/index.vue` renders `<h1>hey, {{ firstName }}.</h1>`
   above the `HomeNarrative` tab strip in the logged-in (`v-else`) branch. User directive: drop it
   at **every** width (mobile + desktop); the logged-in view becomes tabs-only.

`logout`, `user`, and the `initials` derivation already exist and are reused verbatim from
`AppNav.vue` / `useAuth()` (`packages/auth-ui/src/use-auth.ts`). No new data work.

## Fix approach

Placement for logout is user-chosen (2026-08-07): the **nav-drawer footer** — the mobile mirror
of the desktop sidebar footer, whose footer already carries identity + sign-out.

### Phase 1 — mobile logout footer (`AppNavMobile.vue`)
- Extend the `useAuth()` destructure from `{ isLoggedIn }` to `{ isLoggedIn, user, logout }`; add
  the `initials` computed copied verbatim from `AppNav.vue` (`computed` is already imported).
  `closeNav` is already in scope from `useAppNav()`.
- In the `USlideover` `#content`, after the `flex-1` scrolling sections `<div>`, add a `mt-auto`
  bordered footer: the identity `NuxtLink` (avatar-initials chip + `user?.displayName` →
  `/auth/profile`, `:external`, `@click="closeNav"`) and a ghost `i-lucide-log-out` Sign-out
  `UButton` (`aria-label="Sign out"`, `@click="logout"`). Exact markup in
  `docs/specs/mobile-logout/shell.ui.md`.
- No new imports; `UButton`/`UIcon`/`NuxtLink` are auto-imported; `i-lucide-log-out` is in use.

### Phase 2 — remove the home greeting (`home-app/index.vue`)
- Delete `<h1>hey, {{ firstName }}.</h1>` from the logged-in (`v-else`) branch so it renders
  `<HomeNarrative with-workspaces>` only.
- Remove the now-unused `firstName` computed; drop `user` from the `useAuth()` destructure (the
  page keeps `isLoggedIn`; the `session=expired` toast block uses `route`/`router`/`toast`, not
  `user`).
- Not mobile-only — the greeting goes at every width. Authority: `docs/specs/home-app/index.ui.md`.

### Phase 3 — verify + spec upkeep
- Layer edits don't hot-reload — **ask the user to rebuild**; then `pnpm build` gate green.
- Verify read-only in the running UI at a mobile width, logged in: open Menu → footer shows
  identity + Sign out; tapping Sign out logs out and lands on the logged-out home; tapping the
  identity row closes the drawer and opens `/auth/profile`. Desktop `lg`+ sidebar unchanged (no
  duplicate — drawer is `lg:hidden`, sidebar is `hidden lg:flex`).
- Verify the logged-in home (mobile + desktop) shows the tab strip with no greeting above it.
- Flip `docs/specs/mobile-logout/` (README + `shell.ui.md` + `shell.data.md`) status →
  `Implemented`, check its README boxes; update `docs/specs/home-app/index.ui.md` status (greeting
  no longer "specified ahead of the code"). Record any divergence.

## Verification

- `pnpm build` gate green (repo-wide `pnpm lint` is known-broken — do not gate on it).
- Manual, mobile-width round trip as above (user-run rebuild first — never rebuild/restart the env
  yourself).

## Completion

Ask the user (AskUserQuestion): move this plan to `addressed/`?
