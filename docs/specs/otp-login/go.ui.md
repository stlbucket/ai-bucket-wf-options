# OTP Login — Deep-link Landing / Responder Page (UI)

Types / data contract: `_shared.data.md` + `go.data.md`.

## Status
Draft — fill in all `[FILL IN]` sections before implementing.

## Route
`/auth/go/[id]` — a page in **auth-app** (the root of trust; it already hosts the OIDC ceremony,
onboarding, and setup routes). Served at `http://localhost:4000/auth/go/<deepLinkId>`. Reachable
**unauthenticated**. The link the app sends users points here.

Not part of `/auth/login` — OTP login is **only** offered on this deep-link landing page (user
directive: "not available thru the UI for now"). The primary login page is untouched.

## Layout (UCard, mobile-first — this is a phone-first surface, UC4/UC5)

Single centered `UCard`, phone-width. Four render states driven by the deep-link + session state
(§go.data.md decides which):

### State A — dead link (`expired` / `revoked` / unknown)
`UAlert` (color `warning`, persistent — UC7): "This link has expired or is no longer valid." A
single `UButton` "Go to sign in" → `/auth/login`. No OTP offered.

### State B — not logged in, link valid (the core state)
- Header: the item context from `subject_label` + `module` icon (`i-lucide-*` per module — todo →
  `i-lucide-square-check` `[FILL IN]` verify). e.g. **"You've been sent a Todo — Buy milk."**
- Two primary actions, stacked (phone) / side-by-side (≥sm):
  1. **"Sign in with ZITADEL"** — rendered via `<LoginForm :return-to="`/auth/go/${linkId}`" />`
     (the shared auth-layer card). The `returnTo` prop threads the deep-link path through the whole
     ZITADEL round-trip (`auth-app/login.data.md` §Return-to: `loginWithRedirect(returnTo)` →
     `oidc/login` parks `oidc_return_to` → `callback` re-emits `?returnTo=` → `/auth/login` forwards
     after the residency flow). The browser lands **back on `/auth/go/<id>`, now logged in**, and the
     page's already-logged-in path (State D) forwards to the item — same-tenant straight through,
     different-tenant via "Switch & view". This is what makes the standard path match OTP's
     "land on the item." *(Bare `<LoginForm />` with no `returnTo` still goes home — that was the
     original gap: the standard path lost the item and returned to `/`.)*
  2. `UButton` **"Log in with a code"** (variant `outline`) → reveals the OTP sub-form (State C)
     without navigation.
- **No pre-known recipient** — the link is tenant-scoped (D5 revised). The code path opens by asking
  the opener for their own contact (State C step 0). Helper text: "Enter the phone or email you use
  with this workspace and we'll send you a code."

### State C — OTP entry (inline, after "Log in with a code")
- **Step 0 — identify:** a single `UInput` (`inputmode` left default; the value may be a phone or an
  email) "Your phone or email" + `UButton` "Send code" → `POST /auth/api/otp/request` with
  `{ id, identifier }`. The opener self-identifies here; the server matches it to a resident of the
  link's tenant (`_shared.data.md` §7).
  - **Enumeration-safe response** — success is **always** "If that phone/email belongs to a member of
    this workspace, we've sent a code." (UC7 toast + advance to step 2 regardless of match). The UI
    never reveals whether the contact matched. Disable + count down the resend cooldown `[FILL IN]`.
- **Step 1 — enter code:** a `UPinInput` (`[FILL IN]` verify Nuxt UI has it; else `UInput` numeric,
  `inputmode="numeric"`, `autocomplete="one-time-code"` for iOS SMS autofill) + `UButton` "Verify".
  → `POST /auth/api/otp/verify` with `{ id, code }`.
  - success → the endpoint returns `{ redirect }`; `navigateTo(redirect, { external: true })` (full
    reload so the new session's claims + nav + urql caches build under the URN's tenant).
  - wrong/expired code (includes the "no code was ever issued" case for a non-member — same UX) →
    inline `UAlert` (error) "That code didn't work. `[FILL IN]` N tries left." On attempts exhausted
    (or no code on file), collapse back to step 0 ("Check your phone/email and try again").
- "Resend code" link (re-submits step 0's identifier), disabled during cooldown. "Use a different
  phone/email" link → back to step 0.

### State D — already logged in (session cookie present on load)
`go.data.md` resolves this server-side or on mount:
- Same tenant as the link → immediate `navigateTo(redirect, { external: true })` (no card flash if
  resolvable SSR-side — `[FILL IN]` prefer a server redirect).
- Different tenant → brief `UCard`: "Switch to **{{tenantName}}** to view this?" `UButton`
  "Switch & view" → `assumeResidency(residentId)` → full reload into the item. (Mirrors the
  workspace-switcher Enter contract.) A secondary "Not now" → home.

## Optional — temporary-session banner (if §8 `current_session_info` is built)
When the *current* session is `auth_method='otp'`, a slim `UBanner`/`UAlert` (color `info`) on the
tenant-layer shell: "Quick session — expires in {{mins}}m." `[FILL IN]` gated on the §8 decision;
out of scope if that read isn't built.

## Reactive state
```ts
const state = ref<'loading' | 'dead' | 'choose' | 'otp' | 'switch'>('loading')
const identifier = ref('')     // the opener's own phone/email (step 0)
const codeSent = ref(false)    // advanced to step 1 (always true after a request, match or not)
const resendIn = ref(0)        // cooldown seconds, ticks down
const code = ref('')
const attemptsLeft = ref<number | null>(null)
const error = ref<string | null>(null)
```

## Interactions
| Action | Result |
|---|---|
| Load page | fetch deep link (§go.data.md) → pick State A/B/D |
| "Sign in with ZITADEL" | `<LoginForm :return-to="`/auth/go/${linkId}`">` → `loginWithRedirect(returnTo)`; ceremony round-trips back to `/auth/go/<id>` (State D forwards to the item) |
| "Log in with a code" | reveal State C step 0 (no nav) |
| "Send code" (step 0) | `POST otp/request` `{ id, identifier }`; start cooldown; advance to step 1 with the enumeration-safe "if that's a member…" message (regardless of match) |
| "Verify" (step 1) | `POST otp/verify` `{ id, code }`; on ok → external nav to `redirect`; else inline error |
| "Use a different phone/email" | back to step 0 |
| "Switch & view" (State D) | `assumeResidency` → full reload to item |

## UI rules
UC3/UC4 (Nuxt UI + UCard), UC5 (mobile-first — this is the phone surface), UC6 (color tokens),
UC7 (toast for "code sent", persistent UAlert for dead link / errors), UC11 (verify `i-lucide-*`
names before use). No raw HTML/CSS.
