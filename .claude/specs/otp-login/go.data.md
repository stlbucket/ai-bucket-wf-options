# OTP Login — Deep-link Landing / Responder Page (Data)

Types, schema, functions, permissions: `_shared.data.md`. UI: `go.ui.md`.

## Status
Draft — fill in all `[FILL IN]` sections before implementing.

## Where this runs
All server work is **pre-claims root of trust** in **auth-app**'s Nitro `server/`, using db-access
raw pg — the exact posture of `server/api/onboard/*` and `server/api/setup/*`. No GraphQL: these run
before a session/claims exist. (This is REST/H3 carve-out #2 in `graphql-api-pattern.md`.)

## Endpoints (new, `apps/auth-app/server/api/otp/`)

### `GET /auth/api/otp/link?id=<deepLinkId>`  (or SSR load in the page)
- `getDeepLink(id)` (db-access → `app_fn.get_deep_link`).
- Returns the **public projection** only: `{ subjectLabel, module, expired, revoked }`. **No channel
  / destination / recipient** — the link is tenant-scoped, so there is nobody to name yet; the opener
  supplies their contact at `otp/request`. Never the tenant id, roster, or any contact.
- Also reads the request's sealed session cookie (if any) to tell the page State B vs State D
  (`getEventClaims` — already available in auth-app middleware). `[FILL IN]` prefer resolving
  State D server-side and issuing a 302 to `redirect` when same-tenant, to avoid a card flash.

### `POST /auth/api/otp/request`  — body `{ id, identifier }`
Pre-claims. `identifier` = the phone/email the opener typed for themselves. Mirrors
`onboard/request-password.post.ts`:
1. `requestOtpLogin(id, identifier)` (db-access → `app_fn.request_otp_login`) → `{ matched, code?,
   channel?, destination?, destinationMasked? }`. Recipient resolution (match the contact to a
   resident of the link's tenant), rate-limit / cooldown / dead-link all handled in the function.
   - **`matched === false`** (contact isn't a resident of the link's tenant, or no deliverable
     channel) → **respond exactly as the success case** below (`{ ok: true }`), send nothing. The
     browser must not be able to tell a member from a non-member (enumeration-safe — `_shared` §10).
   - a thrown cooldown/rate error → `429 { error: 'cooldown' }` (same for member and non-member; the
     per-link cap is the roster-guessing throttle).
2. **Deliver** (only when `matched`) via the internal `send-notification` webhook (server-to-server,
   shared secret — the `onboard/request-password.post.ts` pattern):
   ```ts
   await $fetch(`${process.env.N8N_INTERNAL_URL}/webhook/send-notification`, {
     method: 'POST',
     headers: { 'x-fnb-webhook-secret': process.env.N8N_WEBHOOK_SECRET },
     body: {
       channel,                       // 'sms' | 'email' — from the matched resident's contact
       templateKey: 'otp-login',      // new template — "Your fnb login code is {{code}}"
       to: destination,               // server-held raw destination from requestOtpLogin — NEVER the browser's identifier echoed back, and never the masked one
       subject: channel === 'email' ? 'Your fnb login code' : undefined,
       vars: { code },
       tenantId: null, profileId: null,
     },
   })
   ```
   The raw `code` + `destination` come back from `requestOtpLogin` **server-side only** and never
   reach the browser.
3. Respond `{ ok: true }` — **no `destinationMasked`** (revealing the masked target of a contact the
   opener typed would confirm membership; the opener already knows their own contact). Fire-and-forget
   on delivery — a webhook failure is `502 { error: 'unavailable' }` (same as onboard).

- **SMS branch dependency:** `channel === 'sms'` requires notify SMS Phase 0/1. Until built, §7 of
  `_shared.data.md` forces `channel = 'email'` for everyone — this route is unchanged when SMS lands.

### `POST /auth/api/otp/verify`  — body `{ id, code }`
Pre-claims. Mirrors the OIDC callback's session-mint tail:
1. `verifyOtpLogin(id, code)` (db-access → `app_fn.verify_otp_login`) → `{ sid, profileId } | null`.
   - `null` → `401 { error: 'bad_code', attemptsLeft }` (`[FILL IN]` return remaining attempts so
     the UI can show "N tries left" — either from the function or a follow-up read). Covers both a
     wrong code **and** the non-member case where no code was ever issued (identical UX).
   - the function raised "no residency" → `403 { error: 'no_access' }` (belt-and-suspenders; §7 match
     already required tenant residency at request time).
2. On `{ sid, profileId }`: `setAppSession(event, { id: profileId, sid })` — the **sealed** cookie,
   identical to the OIDC callback (issue 0010). `profileId` is the resident resolved from the opener's
   contact at request time (§5.2), carried through the `auth.otp_login` row. The workspace was already
   activated inside `verify_otp_login` (§5.3), so the first claims build lands in the URN's tenant.
3. Compute the redirect: `resolveUrnRoute(subjectUrn)` (auth-app `server/utils/urn-route.ts`) →
   e.g. `todo` → `/tenant/tools/todo/<id>`. Respond `{ redirect }`. The client does
   `navigateTo(redirect, { external: true })`.

## `resolveUrnRoute(urn)` — `apps/auth-app/server/utils/urn-route.ts` (new)
Pure. `parseUrn(urn)` (fnb-types) → `{ tenantId, module, type, id }`, then a small map:

```ts
const ROUTES: Record<string, (id: string) => string> = {
  todo: (id) => `/tenant/tools/todo/${id}`,   // verified: apps/tenant-app/app/pages/tools/todo/[id].vue
  // poll, approval, … added as those modules ship (follow-on specs)
}
```
Unknown module → fall back to `/` (home) with a toast `[FILL IN]`. As modules grow, promote this to a
shared resolver (fnb-types is type-only + pure helpers; a *route* map is app-routing knowledge, so it
starts in auth-app — revisit placement when the second module registers).

## Standard ZITADEL path (State B action 1) — return-to round-trip

The "Sign in with ZITADEL" button is **not** one of the pre-claims `otp/*` endpoints — it is the
normal hosted-login ceremony with a **`returnTo`** carried through so the user comes back to
`/auth/go/<id>` (then State D forwards to the item). The full contract lives in
`auth-app/login.data.md` §Return-to; this spec only *consumes* it by passing
`returnTo=/auth/go/<id>` (via `<LoginForm :return-to>` — `go.ui.md` State B). Nothing new is added
here on the data side: `oidc/login` parks the `oidc_return_to` cookie, `callback` re-emits it as
`/auth/login?oidc=success&returnTo=…`, and `login.vue` navigates there after the residency flow.
`isSafeReturnTo` (root-relative, fail-closed) guards it at park + consume time. When the user
returns logged-in, State D (below) runs.

## Already-logged-in path (State D)
Handled in the page (`go.ui.md` State D) via existing composables — **not** these pre-claims routes:
- Same tenant (`useAuth().user.tenantId === deepLink.tenantId`) → `navigateTo(redirect, { external:
  true })`. `[FILL IN]` — the landing GET needs the tenant id to compare, but `get_deep_link` hides
  it; either compare `module`+`assumeResidency` optimistically, or add a claims-gated
  `app_api.deep_link_tenant(id)` read that returns the tenant id **only to an authenticated caller**.
  Propose the latter (small, RLS-safe).
- Different tenant → `assumeResidency(residentId)` (workspace-switcher's `useResidency`) → full
  reload to `redirect`. `[FILL IN]` — need the caller's `residentId` in that tenant: derivable from
  `useAuth().user.residencies` (the claims residency tree) filtered by the deep link's tenant.

## db-access wrappers
See `_shared.data.md` §9: `getDeepLink`, `requestOtpLogin`, `verifyOtpLogin`, `createSession`
(extended). All raw pg, camelCased, returning hand-written types.

## Failure semantics (fail closed — matches session-refresh-pattern)
Unknown/expired/revoked link → State A (never 500). Wrong/expired code → `401`, attempts tick.
No residency in tenant → `403 no_access`. Webhook down → `502 unavailable`. Tampered/forged
`id` → dead-link. No path 500s; none leak more than expired/revoked.
