# Set Password (Data) — auth-app server route

## Status
Draft. One **unauthenticated** H3 route in auth-app. Calls ZITADEL management/v2 through the shared
admin client (`zitadel-admin-client.md`). No fnb GraphQL/RLS surface. REST/H3 carve-out.

## Route: `POST /auth/api/onboard/set-password`
File: `apps/auth-app/server/api/onboard/set-password.post.ts`

```ts
// body: { userId: string, code: string, password: string }
```
1. Validate all three present; re-check `password` length server-side (never trust the client).
2. ZITADEL `POST /v2/users/{userId}/password`
   `{ newPassword: { password, changeRequired: false }, verificationCode: code }`
   (`zitadel-admin-client.md` call 5).
   - `changeRequired: false` — the invitee just chose it (do not force a change at first login).
3. **On 2xx** → respond `200 { ok: true }`; the page redirects to `/auth/login?welcome=1`.
   The user is now VERIFIED / HAS-PW and can sign in via the ZITADEL hosted login; first login runs
   the existing `provision_idp_user` email-match → the `invited` resident is linked/activated
   (`zitadel-login-pattern.md:46`).
4. **On ZITADEL 4xx**:
   - bad/expired/used code → `410 { error: 'expired' }` → page `expired` state.
   - password-policy violation → `422 { error: 'policy', message }` → page error toast with the
     message.
5. Do **not** create a session here — the invitee logs in normally afterward (keeps one
   authentication path: the ZITADEL hosted login + OIDC callback). No auto-login shortcut.

## Security notes
- Unauthenticated by necessity (no session yet); the ZITADEL reset `code` (single-use, expiring,
  possession-proving from email #2) is the authorization. There is no `onboard_verified` cookie
  requirement here because the reset code itself is the secret — but apply the same Phase 4
  rate-limiting.
- The route only ever sets the password for the `userId` the reset `code` was minted for — ZITADEL
  rejects a code that does not match the user, so a swapped `userId` fails at ZITADEL.

## Errors → page states
| Condition | Response | Page |
|---|---|---|
| set ok | `200` | redirect `/auth/login?welcome=1` |
| bad/expired code | `410 expired` | `expired` |
| policy violation | `422 policy` + message | error toast (stay `form`) |
| ZITADEL/network error | `502` | error toast |

## Open Questions
- [ ] Prod password policy source for the client hint + server re-check — read from ZITADEL
      (login/password-complexity policy API) vs. mirror the known values in config. Dev relaxes it
      (`zitadel-login-pattern.md:119`).
