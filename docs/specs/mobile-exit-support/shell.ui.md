# mobile-exit-support — UI

## Status
Implemented (code + build) — 2026-08-03. UI-only; single file touched (`default.vue`).
`pnpm build` green; running-UI verification pending a user env rebuild.

## Component touched

| File | Change |
|---|---|
| `packages/tenant-layer/app/layouts/default.vue` | Add a support-mode "Exit Support" button to the slim mobile brand header's right-hand cluster |

No changes to `AppNav.vue`, `AppNavMobile.vue`, `UserProfileStatus.vue`, the bottom tab bar, or
the nav drawer.

## Context — the mobile header today

`default.vue` renders a slim brand bar that is **mobile-only** (`lg:hidden`); the desktop sidebar
(`AppNav`, `hidden lg:flex`) replaces it at `lg` and up. The bar has a brand link on the left and
an `ml-auto` action cluster on the right (currently the color-mode toggle, and a "Sign in" button
when logged out):

```vue
<header
  class="flex items-center gap-3 border-b border-(--ui-border) bg-blue-900 px-4 py-2.5 text-white lg:hidden"
>
  <NuxtLink to="/" :external="true" class="flex items-center gap-2.5">
    <FunctionBucketMark color="secondary" :monogram="false" class="size-6" />
    <span class="font-mono text-sm font-bold tracking-tight">function-bucket</span>
  </NuxtLink>
  <div class="ml-auto flex items-center gap-2">
    <ClientOnly>
      <UColorModeButton class="text-white/70 hover:bg-white/10 hover:text-white" />
    </ClientOnly>
    <UButton v-if="!isLoggedIn" … >Sign in</UButton>
  </div>
</header>
```

## Script additions

`default.vue` already imports and calls `useAuth()` (for `isLoggedIn`). Extend the destructure and
add the support-mode computed — the same predicate `AppNav.vue` uses:

```ts
import { computed } from 'vue'
import { useAuth } from '@function-bucket/fnb-auth-layer/app/composables/useAuth'
// … existing imports (useRuntimeConfig) …

const { isLoggedIn, user, exitSupport } = useAuth()
const isInSupportMode = computed(() => user.value?.permissions?.includes('p:exit-support'))
```

`user`, `exitSupport`, and the `permissions` shape all come from the existing `useAuth()` surface
(`packages/auth-ui/src/use-auth.ts`); no new import beyond `computed`.

## Template — the button

Add the button as the **first** child of the `ml-auto` cluster (before `UColorModeButton`), so the
warning affordance leads the right side:

```vue
<div class="ml-auto flex items-center gap-2">
  <UButton
    v-if="isInSupportMode"
    size="xs"
    color="warning"
    variant="soft"
    icon="i-lucide-log-out"
    @click="exitSupport"
  >
    Exit Support
  </UButton>
  <ClientOnly>
    <UColorModeButton class="text-white/70 hover:bg-white/10 hover:text-white" />
  </ClientOnly>
  <UButton v-if="!isLoggedIn" … >Sign in</UButton>
</div>
```

This is the exact button from `AppNav.vue`'s expanded footer (`size="xs" color="warning"
variant="soft" icon="i-lucide-log-out"`, label "Exit Support"), minus the desktop-only `ml-1`
spacing class.

## Reactive state / badges
- New reactive state: `isInSupportMode` (computed off `useAuth().user`). No status badges.
- No new refs, watchers, or lifecycle hooks.

## Interactions

| Element | Action | Result |
|---|---|---|
| Exit Support button | Tap / Enter / Space | Calls `useAuth().exitSupport()` → deactivates the support resident, reactivates the home resident, refreshes claims, then `goHome()` (full external reload to `/`). See `shell.data.md`. |
| — (not in support mode) | Load | Button absent (`v-if="isInSupportMode"` false); header shows only color-mode (+ Sign in when logged out), unchanged. |

## Responsiveness (UC5)
- The header is `lg:hidden`; the button lives inside it, so it only ever renders on mobile — the
  desktop `AppNav` footer button already covers `lg` and up. No overlap, no duplicate affordance at
  any width.
- Narrow-phone note: on very small widths (≲360px) the brand wordmark + button + color-mode toggle
  could crowd. If observed in verification, fall back to icon-only (`aria-label="Exit Support"`,
  drop the text) per the desktop icon-rail precedent — tracked in the README's Open Questions.

## Known Gaps
- None beyond the narrow-width note above.
