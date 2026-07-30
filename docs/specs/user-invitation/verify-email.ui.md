# Verify Email (UI) — `/auth/verify-email`

## Status
Draft. New **unauthenticated** page in auth-app (`apps/auth-app/app/pages/verify-email.vue`),
Caddy path `/auth/verify-email`. Landing target of **email #1**. Auto-verify on load (U3).

## Query params
`?userId=<zitadelUserId>&code=<emailCode>` — both required; a missing/blank param renders the
`invalid` state without calling the server.

## State machine (single-page)

```
verifying ──POST verify-email ok──► verified ──button──► sendingLink ──ok──► linkSent
     │                                                        │
     └── error ──► expired/invalid                            └── error ──► verified (with error toast)
```

| State | Shows |
|---|---|
| `verifying` | `UCard` + spinner: "Verifying your email…" |
| `verified` | `UCard`: "Email verified ✓" + intro copy + **UButton "Send me a link to set my password"** |
| `sendingLink` | button `loading`; disabled |
| `linkSent` | `UAlert` (success, persistent — UC7): "Check your inbox — we've sent a link to set your password." Button hidden. |
| `expired` / `invalid` | `UAlert` (warning): "This link is invalid or has expired. Ask your admin to re-invite you." No retry (a new code needs a new email). |

## Layout

`UCard` (UC4) centered in the auth-layer shell (reuse whatever centered container `login.vue`
uses). Nuxt UI components only (UC3). Brand mark / heading consistent with `login.vue`.

```
<UCard>
  <h1>Welcome to fnb</h1>
  <!-- verifying -->  spinner + "Verifying your email…"
  <!-- verified  -->  "Email verified ✓"  <p>One more step — set your password.</p>
                      <UButton block :loading="state==='sendingLink'" @click="requestLink">
                        Send me a link to set my password
                      </UButton>
  <!-- linkSent  -->  <UAlert color="success" title="Check your email"
                              description="We sent a link to set your password to your inbox." />
  <!-- expired   -->  <UAlert color="warning" ... />
</UCard>
```

## Reactive state
```ts
const route = useRoute()
const userId = route.query.userId as string | undefined
const code = route.query.code as string | undefined
const state = ref<'verifying'|'verified'|'sendingLink'|'linkSent'|'expired'|'invalid'>('verifying')
```

## Interactions

| Action | Result |
|---|---|
| Page load (valid params) | `POST /auth/api/onboard/verify-email` → `verified` \| `expired` |
| Page load (missing params) | `invalid` (no server call) |
| Click **Send me a link…** | `sendingLink` → `POST /auth/api/onboard/request-password` → `linkSent` \| error toast |

- On `verified`, the server set a short-lived httpOnly cookie (U5) that the request-password call
  requires — the page just calls the route; the cookie rides automatically.
- Data contract: `verify-email.data.md`.

## Notes
- No auth-ui `useAuth()` here — the invitee has no session. Page is public
  (`definePageMeta` — confirm the auth-layer's public-route convention; `login.vue` is the model).
- Icons: `i-lucide-badge-check` (verified), `i-lucide-mail-check` (link sent) — UC11.
