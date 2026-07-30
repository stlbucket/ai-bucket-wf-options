# future-auth: Client Claims Revalidation — stale localStorage claims detection & recovery

## Status
**Implemented 2026-07-09**, verified in-browser by the user same day. Companion to
`session-refresh-pattern.md` (server-side session lifetimes) — this file covers the
**client-side mirror** of that authority.

## Problem

`ProfileClaims` are mirrored to localStorage (`auth.user` via `useStorage` in
`packages/auth-ui/src/use-auth.ts`) because the JSON overflows `Set-Cookie` (nginx 502). The
httpOnly sealed `session` cookie + `auth.session` row are the root of trust — but nothing ever
revalidates the localStorage mirror against them. Two distinct ingestion paths leave the UI
rendering a module set for a session that no longer exists:

1. **Stale-but-plausible claims.** The session dies out from under the browser — stack rebuild
   (DB wiped, session rows gone), idle timeout (24h), absolute cap (7d), or revocation (all per
   `session-refresh-pattern.md`). The stored claims still look valid, and
   `packages/auth-layer/app/plugins/hydrate-claims.client.ts` **early-returns when
   `user.value !== null`** — it only self-heals the empty-storage case, never the stale case.
   `useAppNav` then renders the old module set; every GraphQL call runs unauthenticated and
   returns empty data.

2. **All-null claims objects.** When the session is invalid, `jwt.uid()` is null and
   `app_api.current_profile_claims()` returns an `app_fn.profile_claims` composite with every
   field null. `fetchProfileClaims`
   (`packages/graphql-client-api/src/composables/useProfileClaims.ts`) only guards `!cpc` — a
   non-null row of nulls passes through and is **stored as the user**. Since
   `isLoggedIn = user.value !== null`, an all-null claims object reads as logged-in. This is the
   observed "fields in the profile claims are null" symptom (any post-expiry `refreshClaims()`
   call — login flow, site-admin pages, exitSupport — can write it).

Not a security hole: RLS + the server-side session row remain the authority, so no data leaks.
It is a correctness/UX defect — a ghost-logged-in UI with dead nav and empty pages.

## Decisions

- [x] **Validity predicate** → claims are valid iff `profileId !== null`. A logged-in profile
      with no active residency still has `profileId` set (see the `else` branch of
      `app_fn.current_profile_claims`), so this is the minimal correct test. Enforced at
      **ingestion**, not at every read site.
- [x] **Revalidate on every app boot** → the hydrate plugin always fetches fresh claims, not
      just when storage is empty. Each app behind nginx is a separate Nuxt app, so every
      cross-app navigation is a full page load → the plugin re-runs at every app boundary.
      SPA-internal navigation does not re-trigger; acceptable (server enforces auth per
      request — only the nav display can go stale mid-session, until the next boundary).
- [x] **Fail-soft on fetch errors** → only a **definitive** "no claims" response (null /
      null-`profileId`) clears storage. A thrown fetch (network blip, API restarting) keeps
      last-known claims and logs — clearing on transient errors would spuriously log users out
      during every stack restart.
- [x] **Recovery UX** → clear `user.value` (localStorage) and hard-navigate to the root home
      page `/` (home-app hero + sign-in button) with `?session=expired`; home shows a one-shot
      toast (UC7). When already on home-app `/`, skip the navigation — clearing `user` flips
      the hero reactively.
- [x] **No SSO teardown** → stale detection does **not** run the ZITADEL RP-initiated logout.
      A live ZITADEL SSO session is an asset here: clicking sign-in bounces silently through
      the hosted login with no credential prompt (same UX as the absolute-cap bounce in
      `session-refresh-pattern.md`).

## Design

### 1. Ingestion guard — `fetchProfileClaims` returns null for invalid claims

`packages/graphql-client-api/src/composables/useProfileClaims.ts`: after the existing `!cpc`
check, also `return null` when `cpc.profileId == null`. This makes "null = logged out" airtight
at the single choke point every claims write flows through (`refreshClaims`, login flow,
hydrate plugin). All-null claims objects can never reach localStorage again.

### 2. Always-revalidate hydration — `hydrate-claims.client.ts`

Replace the `if (user.value !== null) return` early-out with unconditional revalidation on
`onNuxtReady` (client-only, same plugin, same `runWithContext` wrapper):

```
fresh = fetchProfileClaims(client)        (via refreshClaims — writes user.value)

fresh valid            → stored claims overwritten (also picks up permission/module
                         changes granted since the last load — a free correctness win)
fresh null, had claims → STALE: user.value = null; if route.path !== '/' or app !== home,
                         navigateTo('/?session=expired', { external: true })
fresh null, no claims  → stay logged out (today's behavior)
fetch throws           → keep last-known claims, console.error (fail-soft; today's behavior)
```

Implementation note: capture `const hadClaims = user.value !== null` **before** calling
`refreshClaims()` (which overwrites `user.value` with the fetch result), then branch on
`hadClaims && user.value === null` for the stale path. Concurrency with the login page's
`?oidc=success` refresh is benign (both fetch the same fresh claims); the in-flight dedupe in
issue `0190__auth______auth-ui-hardening` remains the proper fix and this design does not
depend on it.

### 3. Expired-session toast — home-app `index.vue`

On mount (client), if `route.query.session === 'expired'`: `useToast().add(...)` — e.g. title
"signed out", description "your session ended — sign in to continue", `color: 'warning'` — then
`router.replace` to strip the query param so refresh/bookmark doesn't re-toast. UC7: toast, not
a persistent `UAlert`, because the hero's sign-in button is the persistent affordance.

## Request/boot flow (after this change)

```
app boot (any app) → urql plugin provides $urqlClient → hydrate-claims onNuxtReady
  → fetchProfileClaims (network-only)
      valid claims  → localStorage refreshed → nav renders current module set
      null          → hadClaims ? clear + redirect '/?session=expired' : remain logged out
      throw         → keep last-known (log)
home-app '/' with ?session=expired → toast once → param stripped → hero + sign-in
sign-in → hosted ZITADEL login (silent if SSO session alive) → callback → new session row
```

## File inventory (planned)

| Layer | File | Change |
|---|---|---|
| graphql-client-api | `src/composables/useProfileClaims.ts` | return null when `cpc.profileId == null` |
| auth-layer | `app/plugins/hydrate-claims.client.ts` | always revalidate; stale → clear + redirect `/?session=expired` |
| home-app | `app/pages/index.vue` | one-shot expired-session toast + query-param strip |
| specs (R21) | this file → status flip; `zitadel-login-pattern.md` client-claims note; `session-refresh-pattern.md` cross-ref | same change as the code |

No DB, no server routes, no new packages. `packages/auth-ui/src/use-auth.ts` is untouched
(the ingestion guard lives below it; logout/refresh hardening stays with issue 0190).

Restart note: `packages/*-layer` and `packages/graphql-client-api` edits do not hot-reload in
the Docker dev stack — ask the user to `docker compose restart` the affected apps (never a
rebuild; a rebuild wipes the DB, which is itself the easiest way to *cause* this bug).

## Verification (stage-gate for implementation)

- **Stale-claims path**: log in, then kill the session server-side (delete/revoke the
  `auth.session` row, or rewind `last_seen_at` past 24h — no rebuild needed). Reload any app:
  localStorage `auth.user` is cleared, browser lands on `/` with the hero + sign-in button and
  the expired-session toast shows once (gone after a manual refresh).
- **All-null guard**: with no valid session, call the claims fetch (e.g. visit `/login` paths
  that invoke `refreshClaims`) — localStorage never contains a claims object with
  `profileId: null`.
- **Happy path unchanged**: valid session + stored claims → reload keeps the user logged in,
  no redirect, no toast; a permission granted since the last load appears in the nav after the
  boundary reload.
- **Empty-storage self-heal unchanged**: valid session + cleared localStorage → claims
  rehydrate silently (existing behavior preserved).
- **Fail-soft**: stop the graphql-api container, reload a logged-in app → user stays
  "logged in" with last-known claims, console error only; restart container, reload → normal.
- **Already-on-home**: stale detection while sitting on home-app `/` clears claims and flips
  to the hero without a navigation loop.
- **SSO silent re-login**: after stale recovery with a live ZITADEL session, sign-in completes
  without a credential prompt.
- `pnpm build` green.

## Explicit non-goals

Focus/interval-based revalidation while a tab stays open (extension point: VueUse
`useDocumentVisibility` + throttled revalidate — add only if mid-session staleness proves
annoying); server-push session-death notification (WS); auto-bouncing straight into the hosted
login on stale detection (`prompt=none` probing — the user chose an explicit sign-in button);
route-middleware auth gating (issue 0170); the logout/refresh error-handling and concurrency
hardening in issue 0190 (complementary, unmerged).
