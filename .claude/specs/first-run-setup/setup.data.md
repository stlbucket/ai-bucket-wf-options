# first-run-setup — `/auth/setup` data & endpoints

## Status
**Ready** — all open questions resolved (2026-07-21).

This feature has **no GraphQL surface**. It runs before any session/claims exist, so every DB
touch goes through `db-access` raw pg (R5 carve-out), and ZITADEL is called with the seeder PAT.
See `_shared.data.md` for the DB function, db-access exports, and the ZITADEL admin client.

## Endpoints (auth-app Nitro, under `/auth`)

### `GET /auth/api/setup/status`

`apps/auth-app/server/api/setup/status.get.ts`

- Calls `anchorExists()` (db-access raw pg).
- Returns `{ needsSetup: boolean }` (`needsSetup = !anchorExists`).
- Unauthenticated, read-only, no side effects. Consumed by `setup.vue` and the login-page gate.

### `POST /auth/api/setup/initialize`

`apps/auth-app/server/api/setup/initialize.post.ts`

Body (validated; reject on missing required fields):

```ts
{
  tenantName: string   // required
  email: string        // required
  password: string     // required
  setupToken: string   // required — matched against auth-app's SETUP_TOKEN
  displayName?: string
  firstName?: string
  lastName?: string
  phone?: string
}
```

Handler sequence (order matters — see idempotency note):

0. **Setup-token gate (mandatory, every env).** Read `process.env.SETUP_TOKEN`. If it is unset or
   empty, the endpoint is misconfigured → **500** `{ error: 'SETUP_NOT_CONFIGURED' }` (fail closed;
   never allow an absent token to mean "no token required"). Compare the request `setupToken` to it
   with a **constant-time** equality check (`node:crypto` `timingSafeEqual` over equal-length
   buffers, length-mismatch → fail). On mismatch → **403** `{ error: 'INVALID_SETUP_TOKEN' }`,
   before any ZITADEL or DB call. See §Auth.
1. **Soft gate.** `if (await anchorExists())` → return **409** `{ error: 'SETUP_ALREADY_COMPLETE' }`.
   (The DB function enforces this hard too; the pre-check just yields a clean status without
   touching ZITADEL.)
2. **Create the ZITADEL user first** (idempotent). `createHumanUser({ email, password,
   givenName: firstName || emailLocalPart, familyName: lastName || emailLocalPart })`
   (`server/utils/zitadel-admin.ts`) — created with `changeRequired: false`. A 409 / "already
   exists" is treated as success. A ZITADEL complexity/validation rejection returns **422** with
   the ZITADEL message (form shows it verbatim).
3. **Initialize the DB** (gated, hard). `initializeAnchor({ tenantName, email, displayName,
   firstName, lastName, phone })` (db-access raw pg → `app_fn.initialize_anchor`). On the
   `SETUP_ALREADY_COMPLETE` exception (race), return **409**.
4. Return `{ ok: true }` (the page then auto-redirects into the ZITADEL OIDC login — see
   `setup.ui.md`).

## Auth — the `SETUP_TOKEN` gate

The `initialize` endpoint is unauthenticated (no session exists yet), so a shared secret guards it
in **every** environment (decision 2026-07-21). auth-app carries `SETUP_TOKEN` in its service env
(`infrastructure.md`); the operator supplies the same value in the setup form's **Setup token**
field. The handler:

- fails **closed** if `SETUP_TOKEN` is unset/empty (**500 `SETUP_NOT_CONFIGURED`**) — there is no
  "token optional" mode;
- compares with `crypto.timingSafeEqual` (guard unequal lengths first to avoid the throw), never
  `===`, so the check does not leak length/prefix via timing;
- runs **before** `anchorExists()` and before any ZITADEL/DB side effect.

`GET /auth/api/setup/status` does **not** require the token — it only reveals the boolean
`needsSetup`, which is already inferable, and the page needs it to gate the mount.

**Why ZITADEL-first:** if the response is lost or the DB step fails, a retry re-runs step 2 as a
no-op (already-exists) and step 3 while the env is still virgin. If the DB already succeeded, the
soft gate in step 1 short-circuits with 409 and the page routes to login. No partial-state trap.

## db-access usage

```ts
import { anchorExists, initializeAnchor } from '@function-bucket/fnb-db-access'
```

- `anchorExists()` — `status.get.ts` and the pre-check in `initialize.post.ts`.
- `initializeAnchor(input)` — `initialize.post.ts` step 3; returns the created `Profile` (unused
  by the response beyond confirming success, but available for logging).

There is **no urql composable and no `apps/auth-app/app/composables/` entry** — the page talks to
the two Nitro routes with `$fetch` (this is the auth-app pre-session zone, like the OIDC routes,
not the PostGraphile data stack). This is a deliberate, documented exception to R1, consistent
with the existing `server/api/auth/oidc/*` handlers.

## Environment the endpoint needs (auth-app)

Added to the `auth-app` compose service (see `infrastructure.md`):

| Var | Value | Used by |
|---|---|---|
| `ZITADEL_INTERNAL_URL` | `${NUXT_ZITADEL_INTERNAL_URL}` (`http://zitadel:8080`) | zitadel-admin transport origin |
| `ZITADEL_EXTERNAL_HOST` | host of `${NUXT_ZITADEL_ISSUER}` (e.g. `localhost:8200`) | `Host` header for instance resolution |
| `ZITADEL_PAT_FILE` | `/zitadel-seed/admin.pat` | seeder PAT (volume already mounted `:ro`) |
| `SETUP_TOKEN` | operator secret (see `infrastructure.md`) | the `initialize` setup-token gate |

**Env naming (resolved 2026-07-21):** the admin util reads the **existing** `NUXT_ZITADEL_*` vars
directly — `NUXT_ZITADEL_INTERNAL_URL` for the transport origin and the host portion of
`NUXT_ZITADEL_ISSUER` for the `Host` header — matching `server/utils/oidc.ts`, which already uses
those names. Do **not** introduce `ZITADEL_INTERNAL_URL` / `ZITADEL_EXTERNAL_HOST` aliases in the
util; the compose entries in `infrastructure.md` map onto the `NUXT_ZITADEL_*` names so there is a
single naming convention across the OIDC and admin clients. `ZITADEL_PAT_FILE` and `SETUP_TOKEN`
are the only genuinely new vars.

## Error surfaces

| Case | HTTP | Body | UI |
|---|---|---|---|
| Missing required field | 400 | `{ error: 'INVALID_INPUT', field }` | inline field error |
| `SETUP_TOKEN` not configured on server | 500 | `{ error: 'SETUP_NOT_CONFIGURED' }` | error alert (operator misconfig), retry |
| Wrong setup token | 403 | `{ error: 'INVALID_SETUP_TOKEN' }` | error alert, token field cleared |
| Anchor already exists | 409 | `{ error: 'SETUP_ALREADY_COMPLETE' }` | error alert + "Go to sign in" |
| ZITADEL complexity/validation reject | 422 | `{ error: 'ZITADEL_REJECTED', message }` | error alert (verbatim), form retained |
| PAT missing / ZITADEL unreachable | 502 | `{ error: 'ZITADEL_UNAVAILABLE' }` | error alert, retry |
| DB failure | 500 | `{ error: 'DB_ERROR' }` | error alert, retry |

Gate order: `SETUP_NOT_CONFIGURED` (500) → `INVALID_SETUP_TOKEN` (403) → `SETUP_ALREADY_COMPLETE`
(409) → ZITADEL → DB. The token is checked before the anchor gate so a wrong token never reveals
whether setup has already run.

## Resolved decisions (2026-07-21)

- **Abuse gate — mandatory `SETUP_TOKEN`, every environment.** Chosen over network-only protection
  and over an "off by default" token. The endpoint fails closed when the token is unset, and the
  empty-env build supplies a value so dev/localhost also requires it (`infrastructure.md`). Full
  rationale and the constant-time comparison are in §Auth above and `_shared.data.md`.
