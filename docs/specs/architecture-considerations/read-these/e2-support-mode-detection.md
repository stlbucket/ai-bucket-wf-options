# E2 — Support Mode Detection in UI

> **Note (transport):** the detection logic below is current, but `exit_support_mode` /
> `become_support` are now invoked as **GraphQL mutations** (`useAuth().exitSupport()` /
> `useBecomeSupport()`), not the Nitro route `apps/tenant-app/server/api/tenants/exit-support.post.ts`
> referenced later (tenant-app has no `server/`). See `graphql-api-pattern.md` → Support mode.

## Detection Logic

Support mode is detected by checking for the `p:exit-support` permission in `ProfileClaims`.
This permission is granted by `become_support` in the DB and is only present while the user
is operating as a support-type resident.

```typescript
const isInSupportMode = computed(
  () => user.value?.permissions?.includes('p:exit-support')
)
```

## Where the Exit Support Button Lives

The affordance is rendered per **viewport** by the tenant-layer shell so it is always visible
regardless of which page the support user navigates to:

- **Desktop** — `AppNav.vue`'s user footer (`packages/tenant-layer/app/components/AppNav.vue`),
  in both the expanded and icon-rail (`navCollapsed`) branches. The sidebar is `hidden lg:flex`.
- **Mobile** — the slim brand header in the tenant-layer `default.vue` layout
  (`packages/tenant-layer/app/layouts/default.vue`), `lg:hidden`. Added by
  `docs/specs/mobile-exit-support/`.

`UserProfileStatus.vue` also carries the same button, but it is not the shell's primary support
affordance today (the nav components above are). The markup is identical across all sites:

```vue
<UButton
  v-if="isInSupportMode"
  size="xs"
  color="warning"
  variant="soft"
  icon="i-lucide-log-out"
  :loading="exiting"
  @click="exitSupport"
>
  Exit Support
</UButton>
```

`exitSupport` comes from `useAuth()` (`packages/auth-ui/src/use-auth.ts`).

## Exit Support Flow

```typescript
// useAuth().exitSupport() — auth-ui/src/use-auth.ts
async function exitSupport(): Promise<void> {
  await fetch(exitSupportUrl, { method: 'POST' })
  await goHome()   // navigateTo('/', { external: true }) — full page reload
}
```

The server route (`apps/tenant-app/server/api/tenants/exit-support.post.ts`) calls
`appApi.exitSupportMode()` → deactivates the support resident → re-activates the home
resident → rewrites the `auth.user` cookie with fresh claims via `setAuthUserCookie`.

Because `goHome()` triggers a full page reload, no explicit `fetchUser()` call is needed
before navigation — the browser re-reads the updated cookie on reload.
