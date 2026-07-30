# Change Password (Data) — auth-app authenticated route

## Status
Draft. One **authenticated** H3 route in auth-app. Self-only: the target ZITADEL user is derived
from the **session**, never from the request body. Uses the db-access `withClaims` carve-out (R5)
for the one RLS-gated read, then ZITADEL call D. No GraphQL mutation (keeps the ZITADEL admin
client on the auth-app side, where the PAT + split-horizon transport already live).

## Route: `POST /auth/api/profile/change-password`
File: `apps/auth-app/server/api/profile/change-password.post.ts`

```ts
// body: { current: string, next: string }   // NO userId/profileId — identity is the session
```

1. **Authenticate:** `getEventClaims(event)` (`packages/auth-layer/server/utils/getEventClaims.ts`).
   No/invalid session → `401`. Keep the claims for step 3.
2. **Validate:** `current` + `next` present; re-check `next` length/complexity server-side (never
   trust the client). `next === current` → `400` (no-op).
3. **Resolve the ZITADEL user id (RLS self-read):** run `app_api.my_idp_user_id()` under
   `withClaims(claims, …)` (db-access). RLS policy `view_self` guarantees it returns only the
   caller's own `app.profile.idp_user_id`. This is the whole "only the owning user" enforcement —
   there is no code path that reads another profile's id.
   - `null` (never OIDC-linked) → `409 { error: 'no-idp-user' }`.
4. **ZITADEL change (call D):** `changeOwnPassword(idpUserId, current, next)` — new
   `zitadel-admin.ts` helper: `POST /v2/users/{id}/password`
   `{ newPassword: { password: next, changeRequired: false }, currentPassword: current }`.
5. Map the result:
   | `changeOwnPassword` result | Response | Page |
   |---|---|---|
   | `{ ok: true }` | `200 { ok: true }` | success toast, clear form |
   | `{ ok:false, kind:'wrong-current' }` | `401 { error:'wrong-current' }` | inline error on Current password |
   | `{ ok:false, kind:'policy', message }` | `422 { error:'policy', message }` | error toast (message) |
   | ZITADEL 5xx / transport throw | `502` | error toast |

## Why the session is the only target source (RLS)
The route **never** accepts a `userId`/`profileId` from the body. The ZITADEL user id comes from
`app_api.my_idp_user_id()`, which under RLS `view_self` (`jwt.uid() = id`) can only ever return the
caller's own row. Combined with ZITADEL verifying `currentPassword`, the two independent gates
mean: you can only change *your own* password, and only if you know it. No `p:app-admin`-changes-
another-user path exists in this route by design (the admin path is a *reset email*, not a set —
`admin-reset.data.md`). This is the "only the owning user … can do this" half of the RLS ask, and
it needs **no new policy** — `view_self` already exists (`00000000010250_app_policies.sql:30`).

## Security notes
- `changeRequired: false` — the user chose it deliberately; do not force a re-change next login.
- Do **not** log `current`/`next`. This route (unlike n8n) never puts a password in a run log —
  a deliberate reason change-password is a direct auth-app route and NOT an n8n workflow (passwords
  must not transit the n8n run log).
- Session after change: ZITADEL self password-change does not necessarily revoke the fnb session
  (the session is fnb's sealed cookie, independent of the ZITADEL credential). Confirm no forced
  re-login is needed; if ZITADEL revokes its own sessions, the fnb session is unaffected. *(OQ)*

## Open Questions
- [ ] ZITADEL `currentPassword` verification field + a distinguishable wrong-password 4xx (Phase 0,
      shared with `_shared.data.md`).
- [ ] Does a self password change need to re-issue / keep the fnb session? (Expected: keep.)
