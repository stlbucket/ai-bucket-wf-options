# mobile-exit-support — Data

## Status
Implemented (code + build) — 2026-08-03. **No new data work.** This file records the pre-existing
contract the mobile button reuses; the change is UI-only (`shell.ui.md`).

## Detection — "am I in support mode?"

Support mode is the presence of the `p:exit-support` permission in `ProfileClaims`, granted by
`become_support` in the DB and present only while the user operates as a support-type resident:

```ts
const isInSupportMode = computed(() => user.value?.permissions?.includes('p:exit-support'))
```

`user` is `useAuth().user` (`packages/auth-ui/src/use-auth.ts`); `permissions` is part of the
mirrored `ProfileClaims`. Same predicate as `AppNav.vue`, `UserProfileStatus.vue`, and the
architecture note `docs/specs/architecture-considerations/read-these/e2-support-mode-detection.md`.

## Exit action — `useAuth().exitSupport()`

Bound directly to the button's `@click`. Provided by `useAuth()` (`auth-ui/src/use-auth.ts`);
invoked as a **GraphQL mutation** (per the transport note atop e2), then a full-page reload:

```ts
// auth-ui/src/use-auth.ts (shape — authoritative source is the file)
async function exitSupport(): Promise<void> {
  // exit_support_mode mutation: deactivate the support resident,
  // reactivate the home resident, rewrite session claims
  await goHome() // navigateTo('/', { external: true }) — full reload re-reads fresh claims
}
```

Because `goHome()` triggers a full external navigation, no explicit `fetchUser()`/claims refetch is
needed in the component before navigating — the reloaded app re-reads the updated session.

## GraphQL / composables / mutations
- **None new.** No `.graphql` document, generated hook, composable, or app re-export is added.
- Data surface consumed: `useAuth()` → `{ user, exitSupport }` (already exported and used by
  `AppNav.vue`).

## Auth requirements
- The affordance is self-gating: `exitSupport` / `p:exit-support` only exist for an active support
  resident, so the button only renders (and the mutation only succeeds) in that state.

## Open Questions
- [ ] None. (The one UI edge case — narrow-width crowding — lives in `shell.ui.md` / the README.)
