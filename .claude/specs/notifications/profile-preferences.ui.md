# Notification Preferences — UI (user profile)

## Status
Draft — fill in all `[FILL IN]` sections before implementing. **SMS Phase 1** (D12/D13).

Lets a signed-in user choose their **preferred notification method(s)** — email and/or SMS — from
their profile. Multi-select (D-original ask: "preferred method(s)", plural). SMS can only be
*enabled* once the phone is **verified** (D13); the card drives the non-auth phone-verification
flow inline.

## Host page

The existing **auth-app profile page** — `/auth/profile` → `apps/auth-app/app/pages/profile.vue`
(`auth-app/profile.ui.md`). Today it renders a centered grid of `<UserProfile>` +
`<ChangePasswordForm>`. This adds a third card, **`<NotificationPreferences>`**, into that grid
(UC5 stack on mobile). Component lives in the **notify-owning layer** so the composable + types stay
module-cohesive — `[FILL IN]` confirm target: `packages/tenant-layer` (shared) vs. an auth-app
`components/` local. Recommend a shared layer component since preferences read `notify` GraphQL.

## Layout (Nuxt UI v4, UC3/UC4)

`<UserProfile>` remains claims-only (localStorage, no fetch). `<NotificationPreferences>` is a
`UCard` (UC4) that **does** read/write `notify` GraphQL (a page-level data card — not a leaf
component making calls, so R2 is respected: the card is the composable consumer, like a page).

- **Header:** "How should we reach you?"
- **Channel toggles** — one row per channel:
  | Channel | Control | Sub-state |
  |---|---|---|
  | Email | `USwitch` (enabled) | destination = profile email (read-only, `UBadge` "verified" — ZITADEL-owned) |
  | SMS | `USwitch` | **disabled unless phone verified**; shows the phone + a verify affordance |

- **SMS phone + verification block** (shown under the SMS row):
  - `UInput` for the E.164 phone (prefilled from `app.profile.phone` if set).
  - State machine:
    | State | UI |
    |---|---|
    | no phone | input + `UButton` "Send code" (primary) |
    | code sent | `UPinInput`/`UInput` for the OTP + "Verify" + "Resend" (cooldown), `UBadge` neutral "unverified" |
    | verified | phone shown, `UBadge` success "verified", SMS `USwitch` now enabled |
  - In **dev** the OTP is read from the **SMS-Test page's inbox** (log-sink; `sms-test.ui.md`) —
    call this out inline for testers (`[FILL IN]` — a dev-only hint banner vs. docs-only).

- **Save:** channel toggles persist on change (optimistic) via `useNotificationPreferences()`;
  `useToast` (UC7) confirms. Verification actions have their own buttons/loading.

## Interactions

| Action | Result |
|---|---|
| Toggle Email/SMS | upsert preference (enabled) → toast; SMS toggle is inert while unverified |
| Enter phone → "Send code" | `triggerWorkflow('phone-verification', { phone })` → toast "Code sent" |
| Enter OTP → "Verify" | `verifyPhoneCode(phone, code)` → on success mark verified, enable SMS switch, toast |
| Resend | re-trigger after cooldown (`[FILL IN]` cooldown seconds) |

## Reactive state
`{ prefs: ChannelPreference[], phone, verifyState: 'idle'|'sent'|'verifying'|'verified', code }`.
SMS switch `:disabled="!smsVerified"`.

## Responsive (UC5)
Card fits the profile grid; single column on mobile; toggles full-width.

## Open Questions
- [ ] Component home: shared `tenant-layer` component vs. auth-app-local (recommend shared).
- [ ] Dev OTP hint banner on the card vs. docs-only.
- [ ] Resend cooldown + max-attempts UX copy.
