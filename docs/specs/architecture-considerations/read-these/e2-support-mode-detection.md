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

`UserProfileStatus.vue` (`packages/tenant-layer/app/components/UserProfileStatus.vue`) —
rendered in the header of every page via the default layout in tenant-layer. This ensures
the "Exit Support" affordance is always visible regardless of which page the support user
navigates to.

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
