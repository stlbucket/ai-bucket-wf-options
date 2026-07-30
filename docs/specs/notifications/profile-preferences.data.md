# Notification Preferences — Data (user profile)

## Status
Draft — fill in all `[FILL IN]` sections before implementing. **SMS Phase 1** (D12/D13).

Backs `<NotificationPreferences>` on the profile page. Two concerns: **read/write the user's own
channel preferences**, and **the non-auth phone-verification round-trip** that gates SMS.

## Data model

`notify.channel_preference` + `notify.phone_verification` (schema in `_shared.data.md`). Unlike the
`notify.notification` outbox (writes only inside the workflow), **channel preferences are
user-owned** — so there IS a public mutation surface here, RLS-scoped to `profile_id =
jwt.profile_id()`, following the two-layer `notify_api → notify_fn` pattern (R8).

## Reads

- Operation: `MyChannelPreferences` — `.graphql` at
  `packages/graphql-client-api/src/graphql/notify/query/myChannelPreferences.graphql`. Selects the
  caller's `notify.channel_preference` rows (channel, enabled, destination, verifiedAt). RLS returns
  only the caller's rows (`profile_id = jwt.profile_id()`) — no explicit filter.
- Composable: `useNotificationPreferences()` in
  `packages/graphql-client-api/src/composables/useNotificationPreferences.ts`, thin re-export at
  `apps/auth-app/app/composables/useNotificationPreferences.ts` (R1). Returns
  `{ prefs, smsVerified, fetching, error, setEnabled, executeQuery }`.
- Mapper: `toChannelPreference` (`src/mappers/channelPreference.ts`) → `ChannelPreference`
  (`fnb-types`, R3). `smsVerified` = computed `prefs.some(p => p.channel==='SMS' && p.verifiedAt)`.

## Preference write (public mutation — R8 two-layer)

- Operation: `SetChannelPreference` — mutation `.graphql` at
  `packages/graphql-client-api/src/graphql/notify/mutation/setChannelPreference.graphql` →
  `notify_api.set_channel_preference(_channel, _enabled)` (SECURITY INVOKER) → `notify_fn`
  (SECURITY DEFINER) upsert on `(profile_id, channel)`. RLS + the fn both bind `profile_id =
  jwt.profile_id()` so a caller can only write their own row. **Rejects enabling SMS when the SMS
  row is unverified** (`verified_at is null`) — belt-and-suspenders with the disabled switch (D13).
- `useNotificationPreferences().setEnabled(channel, enabled)` wraps the generated mutation hook;
  re-runs `MyChannelPreferences` `network-only` after success.

## Phone verification round-trip (D13 — gates SMS)

Non-auth phone verification (app-owned OTP is acceptable *only* here per `sms-2fa.future.md`, never
for auth-grade step-up). Two steps:

**1. Request a code** — through the workflow chokepoint (so the OTP SMS rides the single sender):
```
triggerWorkflow(workflowKey: "phone-verification", inputData: { phone /* E.164 */, profileId }) → { runId? }
```
The `phone-verification` workflow (`phone-verification.workflow.md`) calls
`notify_fn.request_phone_verification(profileId, phone)` → generates a 6-digit code, stores its
**hash** + expiry in `notify.phone_verification`, returns the plaintext code to the workflow only →
enqueues `send-notification { channel:'sms', templateKey:'phone-verify', vars:{ code } }`. In dev
(log-sink) the code is read back from the **SMS-Test inbox** (`sms-test.ui.md`).

**2. Verify the code** — a public mutation the user submits:
```
verifyPhoneCode(phone, code) → notify_api.verify_phone_code(_phone, _code) (SECURITY INVOKER)
  → notify_fn.verify_phone_code (SECURITY DEFINER): match newest unconsumed row for
    profile_id = jwt.profile_id(), check hash + expiry + attempts, on success:
      - mark phone_verification consumed
      - upsert channel_preference(sms).verified_at = now(), destination = phone
      - (optional) write app.profile.phone
    returns { verified: boolean, reason? }
```
- Composable methods: `requestPhoneVerification(phone)` (wraps `triggerWorkflow`) and
  `verifyPhoneCode(phone, code)` (wraps the mutation). On verified success, re-run
  `MyChannelPreferences` so the SMS switch un-disables.
- Rate-limit / attempts / expiry live in `notify_fn` (`_shared.data.md`), not the client.

## Requirements
- `'notify'` in `graphile.config.ts` `schemas` (Phase 1) — plus expose `notify_api`'s
  `set_channel_preference` + `verify_phone_code` functions and the `channel_preference` read.
- `phone-verification` registered in `WORKFLOW_REGISTRY` (`phone-verification.workflow.md`).
- `ChannelPreference` added to `fnb-types` + barrel + mapper (`_shared.data.md`).

## Open Questions
- [ ] Persist the verified number to `app.profile.phone` too, or keep it only on the SMS
      preference's `destination`? (Recommend: mirror to `app.profile.phone` for a single source.)
- [ ] Are preferences ever needed in `ProfileClaims`/`pgSettings` (e.g. to route a send)? v1: no —
      the sender reads `channel_preference` directly. Revisit if RLS ever needs the pref.
- [ ] Code length / TTL / max attempts / resend cooldown constants (set in `notify_fn`).
