# ZITADEL Admin Client — management/v2 contract

## Status
**Confirmed against the running instance 2026-07-22** (`ghcr.io/zitadel/zitadel:v4.15.3`) via a live
probe (throwaway user walked through the full lifecycle, then deleted). The ⚠ items below are
resolved — see **Confirmed contract** immediately after. Two corrections vs. the original draft:
(1) email verify is **`/email/verify`** (NO leading underscore — `/email/_verify` 404s on v4.15.3);
(2) an email verification code **cannot be re-issued** for an existing/unchanged address, so the
409 re-invite path must fall back to `password_reset` (below).

## Confirmed contract (v4.15.3, 2026-07-22)

| # | Call | Path | Selector / field | Response |
|---|------|------|------------------|----------|
| 1 | Create human user | `POST /v2/users/human` | body needs `organization.orgId`; `email.returnCode: {}`; **omit `password`** | `200 { userId, emailCode }` |
| 1b| Search by email | `POST /v2/users` | `{ queries: [{ emailQuery: { emailAddress } }] }` | `200 { result: [{ userId, … }] }` |
| 2 | Verify email | `POST /v2/users/{userId}/email/verify` **(no `_`)** | `{ verificationCode }` | `200` → `human.email.isVerified = true` |
| 3 | Request pw reset | `POST /v2/users/{userId}/password_reset` | `{ returnCode: {} }` | `200 { verificationCode }` |
| 4 | Set password | `POST /v2/users/{userId}/password` | `{ newPassword: { password, changeRequired: false }, verificationCode }` | `200` |
| 5 | Get user | `GET /v2/users/{userId}` | — | `{ user: { human: { email:{email,isVerified}, profile } } }` |

Facts confirmed by the probe:
- **`organization.orgId` is required** in create (matches `seed.mjs:226`); resolve it once via
  `GET /management/v1/orgs/me` → `.org.id`. The `x-zitadel-orgid` header is optional for the
  user-id-addressed v2 calls (harmless to send; the seeder sends it).
- A user created with no password + `returnCode` comes back **`USER_STATE_ACTIVE`** with the code in
  **`emailCode`** (not `verificationCode` — that field name is only on calls 2/3). Email is
  unverified; login is still blocked until a password exists (the safety property holds).
- `password_reset` succeeds **regardless of email-verified state** and reliably returns
  `verificationCode` for any existing user → it is the robust primitive for the 409 re-invite path.
- **No usable email-code resend:** `POST /v2/users/{id}/email` with the same address → `400 "Email
  not changed"`; `POST /email/resend` → `400 "Code is empty"`; `/email/_resend`, `/email/resend_code`
  → 404. Do **not** try to re-mint an email code for a re-invite — see the 409 note in
  `invite-user.workflow.md`.
- Dev password policy accepted `Probe-Passw0rd!` (relaxed, per `zitadel-login-pattern.md:119`).
- Transport: the same `node:http` + external-`Host` split-horizon `seed.mjs`/`oidc.ts` use; PAT read
  from `/zitadel-seed/admin.pat` (the FirstInstance `ZITADEL_FIRSTINSTANCE_PATPATH`), Bearer.

> The historical draft (with ⚠ markers) is kept below for context; the table above is authoritative.

## (Historical draft — superseded by the table above)
The endpoint **paths and field names below are from the ZITADEL v2 user service** — kept for the
rationale/notes; where they differ from the Confirmed contract (notably `/email/_verify` and the
resend), the table wins.

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
- [x] `POST /v2/users/human` returns the email code inline when `email.returnCode` is set — field is
      **`emailCode`**. (Also: `organization.orgId` is required in the body.)
- [x] Return-code selector spelling → **`returnCode`** (not `sendCode`) on `human` and
      `.../password_reset`. (There is no usable `.../email` re-issue — see below.)
- [x] `password_reset` path confirmed at `POST /v2/users/{userId}/password_reset`.
- [x] `.../password` accepts `verificationCode` ✓. **Verify email is `.../email/verify` (NO
      underscore)** and accepts `verificationCode` — the draft's `_verify` returns 404.
- [x] v2 user search → `POST /v2/users` `{ queries:[{ emailQuery:{ emailAddress } }] }` → `result[].userId`.
- [ ] n8n HTTP Request node preserves a `Host` header override (else Code-node/node:http fallback)
      — **still to confirm** when authoring `invite-user.json` (Phase 1); the auth-app side reuses
      `oidc.ts`'s proven `node:http` transport.
- [ ] Code TTLs (email + reset) — for the "expired link" UX (Phase 4).
- [x] **No email-code resend** for an existing user (`POST /email` = "Email not changed";
      `/email/resend` = "Code is empty") → 409 re-invite must use `password_reset` instead.
