# Verify Email (Data) — auth-app server routes

## Status
Draft. Two **unauthenticated** H3 server routes in auth-app. Both call the ZITADEL management/v2
API through the shared admin client (`zitadel-admin-client.md`) — the same PAT + split-horizon
transport as the OIDC routes. Neither touches fnb RLS/GraphQL (the invitee has no session).

This is a legitimate REST/H3 carve-out (like the OIDC callback), **not** the GraphQL data stack.

## Route: `POST /auth/api/onboard/verify-email`
File: `apps/auth-app/server/api/onboard/verify-email.post.ts`

```ts
// body: { userId: string, code: string }
```
1. Validate `userId` + `code` present.
2. ZITADEL `POST /v2/users/{userId}/email/_verify` `{ verificationCode: code }`
   (`zitadel-admin-client.md` call 3).
3. **On 2xx** → set a short-lived **httpOnly** signed cookie `onboard_verified` (U5) scoped to the
   userId: value = a signed `{ userId, exp }` (reuse the sealed-cookie util from
   `auth-layer/server/utils/session.ts` / `NUXT_SESSION_SECRET`, `zitadel-login-pattern.md:16`).
   TTL ~15 min. Respond `200 { ok: true }`.
4. **On ZITADEL 4xx** (bad/expired/used code) → respond `410 { error: 'expired' }` → page shows the
   `expired` state.

## Route: `POST /auth/api/onboard/request-password`
File: `apps/auth-app/server/api/onboard/request-password.post.ts`

```ts
// body: { userId: string }
```
1. **Require the `onboard_verified` cookie** and that its `userId` matches the body (U5 anti-abuse —
   only someone who just verified this user's email can trigger the reset mail). Mismatch/absent →
   `401`.
2. ZITADEL `POST /v2/users/{userId}/password_reset` `{ returnCode: {} }` → `{ verificationCode }`
   (`zitadel-admin-client.md` call 4).
3. GET the user (call 6) for the email + display name (or carry them; the cookie could also hold
   the email).
4. Build `setPasswordUrl = ${APP_ORIGIN}/auth/set-password?userId=${userId}&code=${verificationCode}`.
5. Enqueue **email #2** by POSTing the internal `send-notification` webhook
   (`${N8N_INTERNAL_URL}/webhook/send-notification`, `x-fnb-webhook-secret`) — the same call shape
   the `triggerWorkflow` plugin makes:
   ```jsonc
   { "channel": "email", "templateKey": "set-password", "to": "<email>",
     "subject": "Set your fnb password",
     "vars": { "displayName": "<name>", "setPasswordUrl": "<url>" },
     "tenantId": null, "profileId": null }
   ```
   (No claims here — this is a server-to-server internal webhook call authorized by the shared
   secret, not the claims-gated GraphQL `triggerWorkflow`.)
6. Respond `200 { ok: true }` → page shows `linkSent`.

## Why a cookie handshake (U5)

`request-password` is unauthenticated and emails a credential-reset code by `userId`. Without a
gate, anyone could POST a `userId` and spam reset mails (or nudge an account into a resettable
state). Requiring the `onboard_verified` cookie means the caller must have just completed the
email `_verify` for that same user — i.e. they hold the email #1 code. Combine with basic
IP/userId rate-limiting (Phase 4).

## Errors → page states
| Condition | Response | Page |
|---|---|---|
| verify ok | `200` + cookie | `verified` |
| verify bad/expired code | `410 expired` | `expired` |
| request-pw ok | `200` | `linkSent` |
| request-pw missing/mismatched cookie | `401` | error toast (stay `verified`) |
| ZITADEL/network error | `502` | error toast |

## Open Questions
- [ ] Store email/displayName in the `onboard_verified` cookie to skip the extra ZITADEL GET, or
      always GET fresh? (Freshness vs. one round-trip.)
- [ ] Rate-limit strategy for the two routes (Phase 4).
