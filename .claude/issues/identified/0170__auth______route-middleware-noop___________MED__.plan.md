# Plan: Route auth middleware is a no-op — unauthenticated navigation is never blocked

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/route-middleware-noop.plan.md`
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: MEDIUM** · Workstream: WS3 (app auth) · Identified: 2026-07-05

## Details

`packages/auth-layer/app/middleware/auth.ts`:

```ts
export default defineNuxtRouteMiddleware(() => {
  const { isLoggedIn, goHome } = useAuth()
  if (!isLoggedIn.value) {
    // return goHome()          // ← commented out
  }
})
```

The redirect is commented out, so the middleware does nothing. Any page that relies on `auth`
route middleware for gating renders regardless of auth state. (This is a client-side UX guard, not
the security boundary — the DB RLS layer is the real enforcement per global-rules R13 — but the
guard is advertised and inert.)

`package-layers-pattern.md` lists this file as *"Route middleware: redirects to login if not
authenticated"* — the spec claims behavior the code doesn't have.

## Implication

Protected pages flash/render for logged-out users (they'll get empty data from RLS, but may see
layout, controls, and error states meant for authenticated users). Confusing UX and a broken
contract vs the spec. Low security impact (RLS backstops data), but it's exactly the kind of
disabled-guard that reads as intentional and misleads the next developer.

## Suggested fix

1. Decide intent with the user: should `auth` middleware redirect unauthenticated users to the
   login page (auth-app `/auth/login`)? Almost certainly yes.
2. If yes: restore the redirect. `goHome()` sends to `/`; the more correct target is the login
   route — verify `useAuth()` exposes the right navigation helper, or use `navigateTo('/auth/login')`
   with the app's base path in mind (`NUXT_APP_BASE_URL`). Guard against redirect loops on the login
   page itself.
3. Confirm which pages opt into this middleware (`definePageMeta({ middleware: 'auth' })`) — it may
   need to be applied more broadly, or set globally in a layer.
4. If the guard is deliberately deferred, **delete the file** and remove the spec line rather than
   leaving a commented-out stub (dead-guard-that-looks-alive is the anti-pattern).
5. Update `package-layers-pattern.md` auth-layer inventory to match final behavior (R21).

## Verification

- Logged out, navigate to a protected page → redirected to login (no flash of protected content).
- Logged in → pages render normally; no redirect loop on the login page.
- `pnpm build` green.
