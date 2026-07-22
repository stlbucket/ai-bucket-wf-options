# ZITADEL Admin Client — management/v2 contract

## Status
Draft — the endpoint **paths and field names below are from the ZITADEL v2 user service and must
be confirmed against the running instance** (`ghcr.io/zitadel/zitadel:v4.15.3`,
`zitadel-login-pattern.md:196`) before implementation. This is the same "confirm the return-code
selector" caveat already recorded in `notifications/zitadel-codes.data.md`.

Consumers: the **n8n `invite-user` workflow** (create-user) and the **auth-app onboard server
routes** (verify / password_reset / set-password). Both authenticate the same way and use the same
split-horizon transport.

## Auth — the `fnb-seeder` PAT (U8)

- Service account: the FirstInstance machine user **`fnb-seeder`**, whose **PAT** is written to the
  shared `zitadel-seed` volume at `ZITADEL_FIRSTINSTANCE_PATPATH`
  (`zitadel-login-pattern.md:122`). It is a ready-made **Bearer** token.
- Header: `Authorization: Bearer <pat>`. Management (v1) calls are org-scoped via
  `x-zitadel-orgid: <orgId>` (resolve once from `GET /management/v1/orgs/me`, as `seed.mjs` does).
  The **v2 user service** calls used here are user-id addressed and do **not** require the org
  header, but sending it is harmless and matches the seeder.
- **PAT delivery (Phase 0 Open Question):**
  - *auth-app* already mounts the seed dir (reads `clientId` from `NUXT_ZITADEL_SEED_FILE`) — add a
    read of the PAT file alongside it. Cache the singleton like `oidc.ts` does the client config.
  - *n8n* — mount the `zitadel-seed` volume **ro** into the `n8n` service; a **Code node** reads the
    PAT file (`fs.readFileSync`) at run start. (The file is regenerated on each fresh volume, so a
    static n8n credential would go stale — read it at runtime.)

## Transport — split-horizon (reuse the OIDC pattern)

Identical constraint to `apps/auth-app/server/utils/oidc.ts`
(`zitadel-login-pattern.md:86`): the container reaches ZITADEL at
`NUXT_ZITADEL_INTERNAL_URL` (`http://zitadel:8080`) but must present the **external host** in the
`Host` header so ZITADEL resolves its instance and the issuer matches.

- **auth-app**: reuse the existing node:http transport helper (undici/fetch strips a `Host`
  override — this is why `oidc.ts` uses node:http). Do **not** hand-roll a second fetch client;
  factor the ZITADEL admin calls through the same transport util.
- **n8n**: the HTTP Request node — set the `Host` header explicitly to the external host
  (`localhost:${ZITADEL_HOST_PORT}`) and point the URL at `http://zitadel:8080`. If the node's
  client also strips `Host`, fall back to a Code node using `node:http` (same reason). **Confirm
  during Phase 0** whether n8n's HTTP node preserves a `Host` override.

`BASE = ${NUXT_ZITADEL_INTERNAL_URL}`, `HOST_HEADER = <external host>` for every call below.

## Calls

> Field names marked ⚠ are the ones to confirm against v4.15.3. The overall shapes are stable
> across the v2 user service; the return-code selector is the classic gotcha
> (`returnCode: {}` vs. `sendCode: {}` — requesting `returnCode` makes ZITADEL put the code in the
> response instead of emailing it, which is the whole point of D5).

### 1. Create human user — invite (workflow)

```http
POST /v2/users/human
{
  "username": "<email>",
  "profile": { "givenName": "<first>", "familyName": "<rest|displayName>" },
  "email":   { "email": "<email>", "returnCode": {} }        ⚠ returnCode selector
  // NB: NO "password" field → user has no password (state UNVERIFIED / NO-PW)
}
→ 201 { "userId": "...", "emailCode": "..." }                ⚠ emailCode field name
```
- Omitting `password` entirely is deliberate (contrast `seed.mjs:229`, which sets one). The user
  cannot log in until the set-password step.
- **409 / already-exists** (re-invite, or a seeded email): catch it, then
  `GET`/search the user id (below) and request a **fresh** email code via call **2**.

### 1b. Look up an existing user id (409 path)

```http
POST /v2/users        (list/search)                          ⚠ confirm v2 search path/filter
{ "queries": [ { "emailQuery": { "emailAddress": "<email>" } } ] }
→ { "result": [ { "userId": "..." } ] }
```

### 2. (Re)request an email verification code — return-code (workflow 409 path)

```http
POST /v2/users/{userId}/email
{ "email": "<email>", "returnCode": {} }                     ⚠ returnCode selector
→ { "verificationCode": "..." }                              ⚠ code field name
```

### 3. Verify email (auth-app `verify-email` route, U3 auto-on-load)

```http
POST /v2/users/{userId}/email/_verify
{ "verificationCode": "<code from email #1>" }               ⚠ field name
→ 200 (email now verified)
```
- On a bad/expired code ZITADEL returns 4xx → the route maps to a `410`/`400` the page renders as
  "this link has expired — ask your admin to re-invite you".

### 4. Request a password-reset code — return-code (auth-app `request-password` route)

```http
POST /v2/users/{userId}/password_reset                       ⚠ confirm path (v2 `password_reset`)
{ "returnCode": {} }                                         ⚠ returnCode selector
→ { "verificationCode": "..." }                              ⚠ code field name
```
- The route then GETs the user (call 6) for the email address (if not carried), builds
  `setPasswordUrl`, and enqueues `send-notification` (`set-password` template, email #2).

### 5. Set password with the reset code (auth-app `set-password` route)

```http
POST /v2/users/{userId}/password
{
  "newPassword": { "password": "<new pw>", "changeRequired": false },
  "verificationCode": "<code from email #2>"                 ⚠ field name
}
→ 200 (password set; user is now VERIFIED / HAS-PW → can log in)
```
- `changeRequired: false` — the invitee just chose it; do not force a change at first login.
- Password complexity: ZITADEL enforces the **instance policy** (dev relaxes it,
  `zitadel-login-pattern.md:119`); a policy violation returns 4xx → surfaced on the page.

### 6. Get a user (helper — email lookup for the link)

```http
GET /v2/users/{userId}
→ { "user": { "userId": "...", "human": { "email": { "email": "..." } , "profile": {...} } } }
```

## Phase 0 confirmation checklist
- [ ] `POST /v2/users/human` returns the email code inline when `email.returnCode` is set — exact
      response field (`emailCode`?).
- [ ] The return-code selector spelling (`returnCode` vs `sendCode`) on `human`, `.../email`,
      `.../password_reset`.
- [ ] `password_reset` path exists at `/v2/users/{userId}/password_reset` on v4.15.3 (vs. a
      differently-named reset endpoint).
- [ ] `.../email/_verify` and `.../password` accept `verificationCode` (field spelling).
- [ ] v2 user **search** path + query shape for the 409 email→userId lookup.
- [ ] n8n HTTP Request node preserves a `Host` header override (else Code-node/node:http fallback).
- [ ] Code TTLs (email + reset) — for the "expired link" UX (Phase 4).
