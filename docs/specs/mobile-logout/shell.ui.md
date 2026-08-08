# mobile-logout — UI

## Status
Implemented — 2026-08-07. Built as specified in `AppNavMobile.vue`; `pnpm build` green (13/13).
Pending user rebuild + running-UI verify. No divergence.

## Component touched

| File | Change |
|---|---|
| `packages/tenant-layer/app/components/AppNavMobile.vue` | Add a user footer (identity row + Sign out) to the bottom of the nav-drawer `USlideover` `#content` |

No changes to `AppNav.vue`, `default.vue`, `UserProfileStatus.vue`, the bottom tab bar, or the
`ModuleNavSection` sections.

## Context — the mobile drawer today

`AppNavMobile.vue` renders the bottom tab bar and a left `USlideover` "Menu" drawer. The drawer's
`#content` is a full-height flex column: a brand row, `WorkspaceSwitcher`, then a `flex-1`
scrolling list of `ModuleNavSection`s. It ends there — **no user/identity/sign-out footer** (unlike
the desktop `AppNav.vue`, whose footer carries the avatar, name, color-mode, Exit Support, and
Sign out).

```vue
<template #content>
  <div class="flex h-full flex-col gap-4 p-4">
    <div class="flex items-center justify-between border-b border-white/10 pb-3.5"> … brand … </div>
    <WorkspaceSwitcher />
    <div class="flex flex-1 flex-col gap-4 overflow-y-auto">
      <ModuleNavSection v-for="s in availableSections" :key="s.key" :section="s" />
      <p v-if="availableSections.length === 0" …>No menu sections available.</p>
    </div>
    <!-- ← new footer goes here, as the last child (mt-auto pins it below the flex-1 list) -->
  </div>
</template>
```

## Script additions

`AppNavMobile.vue` already destructures `isLoggedIn` from `useAuth()` and `closeNav` from
`useAppNav()`. Extend the `useAuth()` destructure to pull `user` and `logout`, and add the
`initials` computed copied verbatim from `AppNav.vue`:

```ts
// existing: const { availableSections, navOpen, openNav, closeNav, hydrateSectionState } = useAppNav()
const { isLoggedIn, user, logout } = useAuth()

const initials = computed(() => {
  const name = user.value?.displayName?.trim() ?? ''
  if (!name) return '?'
  const parts = name.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
})
```

`user`, `logout`, and the `displayName` shape all come from the existing `useAuth()` surface
(`packages/auth-ui/src/use-auth.ts`); no new import beyond `computed` (already imported). `closeNav`
is already in scope.

## Template — the footer

Add as the **last** child of the `USlideover` `#content` column (after the `flex-1` sections
`<div>`), so `mt-auto` pins it to the bottom of the drawer. Styling mirrors the desktop expanded
footer (`AppNav.vue`) recolored for the same `bg-blue-900` drawer:

```vue
<div class="mt-auto flex items-center gap-2.5 border-t border-white/10 pt-3">
  <NuxtLink
    href="/auth/profile"
    :external="true"
    class="flex min-w-0 flex-1 items-center gap-2.5"
    @click="closeNav"
  >
    <div
      class="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-blue-900"
    >
      {{ initials }}
    </div>
    <span class="flex-1 truncate text-sm text-white/85">{{ user?.displayName }}</span>
  </NuxtLink>
  <UButton
    icon="i-lucide-log-out"
    variant="ghost"
    aria-label="Sign out"
    class="shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
    @click="logout"
  />
</div>
```

Notes:
- The avatar chip and Sign-out button reuse the exact classes/props from `AppNav.vue`'s expanded
  footer (`bg-green-600`/`text-blue-900` chip; `i-lucide-log-out` ghost button, `white/70` hover).
- The identity link mirrors the desktop `NuxtLink href="/auth/profile" :external` row; adding
  `@click="closeNav"` so the drawer dismisses when the user navigates to their profile.
- The footer lives inside the `v-if="isLoggedIn"` `USlideover`, so it only ever renders logged in —
  no extra guard needed.

## Reactive state / badges
- New reactive state: `initials` (computed off `useAuth().user`). No status badges, no new refs,
  watchers, or lifecycle hooks.

## Interactions

| Element | Action | Result |
|---|---|---|
| Sign out button | Tap / Enter / Space | Calls `useAuth().logout()` → clears the session + localStorage claims and redirects to the logged-out home. See `shell.data.md`. |
| Identity row | Tap | Closes the drawer (`closeNav`) and navigates (external) to `/auth/profile`. |

## Responsiveness (UC5)
- The whole `AppNavMobile.vue` (bar + drawer) is `lg:hidden` / mobile-only; the footer lives inside
  the drawer, so it only renders below `lg`. The desktop `AppNav.vue` footer already covers `lg` and
  up — no duplicate affordance at any width.
- The footer is a single row pinned by `mt-auto`; the drawer is a fixed `max-w-[280px]`, so the
  avatar + truncating name + icon button fit without wrapping (name `truncate`s if long).

## Known Gaps
- None. (Shared-footer extraction with the desktop sidebar is tracked in the README's Open
  Questions.)
