# first-run-setup — `/auth/setup` data & endpoints

## Status
Draft — fill in all [FILL IN] sections before implementing.

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
  displayName?: string
  firstName?: string
  lastName?: string
  phone?: string
}
```

Handler sequence (order matters — see idempotency note):

1. **Soft gate.** `if (!(await anchorExists()) === false)` → i.e. if `anchorExists()` is already
   true, return **409** `{ error: 'SETUP_ALREADY_COMPLETE' }`. (The DB function enforces this
   hard too; the pre-check just yields a clean status without touching ZITADEL.)
2. **Create the ZITADEL user first** (idempotent). `createHumanUser({ email, password,
   givenName: firstName || emailLocalPart, familyName: lastName || emailLocalPart })`
   (`server/utils/zitadel-admin.ts`). A 409 / "already exists" is treated as success. A ZITADEL
   complexity/validation rejection returns **422** with the ZITADEL message (form shows it).
3. **Initialize the DB** (gated, hard). `initializeAnchor({ tenantName, email, displayName,
   firstName, lastName, phone })` (db-access raw pg → `app_fn.initialize_anchor`). On the
   `SETUP_ALREADY_COMPLETE` exception (race), return **409**.
4. Return `{ ok: true }` (the page then redirects to the ZITADEL login — see `setup.ui.md`).

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

`NUXT_ZITADEL_INTERNAL_URL` / `NUXT_ZITADEL_ISSUER` already exist on auth-app; the admin util can
read them directly or via the aliases above — [FILL IN] pick one naming and keep it consistent
with `server/utils/oidc.ts`.

## Error surfaces

| Case | HTTP | Body | UI |
|---|---|---|---|
| Missing required field | 400 | `{ error: 'INVALID_INPUT', field }` | inline field error |
| Anchor already exists | 409 | `{ error: 'SETUP_ALREADY_COMPLETE' }` | error alert + "Go to sign in" |
| ZITADEL complexity/validation reject | 422 | `{ error: 'ZITADEL_REJECTED', message }` | error alert (verbatim), form retained |
| PAT missing / ZITADEL unreachable | 502 | `{ error: 'ZITADEL_UNAVAILABLE' }` | error alert, retry |
| DB failure | 500 | `{ error: 'DB_ERROR' }` | error alert, retry |

## Open Questions

- [ ] **Rate limiting / abuse.** The endpoint is unauthenticated. The `anchor_exists` gate makes
      it inert after first success, but before that a bad actor who can reach `/auth/setup` on an
      un-provisioned deploy could claim the anchor. Is network-level protection (deploy behind the
      operator only until setup completes) sufficient, or do we want a one-time setup token
      (env `SETUP_TOKEN`) the operator must supply? [FILL IN — recommend a `SETUP_TOKEN` for
      internet-exposed empty deploys; unnecessary for dev/localhost.]
