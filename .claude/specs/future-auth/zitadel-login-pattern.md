# future-auth: ZITADEL as Login Provider (Scenario 1)

## Status
**Implemented** — all five stages delivered and verified on a fresh rebuild 2026-07-09
(cutover complete: the password path is gone; ZITADEL is the only way to authenticate).
Companion analysis: `zitadel-replacement-analysis.md` (scenario 1 is what this implements).
Plan (closed): `.claude/issues/addressed/0350__auth______zitadel-login-provider__________HI___.plan.md`
Decisions record: see **Decisions** at the bottom.

## Scope contract (what this change is and is not)

- ZITADEL handles **only the login ceremony**. Its sole output consumed by fnb is an
  authenticated identity: `sub` (stable user id), `email`, `email_verified`, `name`.
- Licensing / permissions / residency / tenants / RLS are **untouched** — claims still come from
  `app_fn.current_profile_claims()` via the existing auth middleware.
- The httpOnly `session` cookie remains the root of trust. Its encoding is the **sealed** blob
  from issue 0010 (landed together with stage 3, per Decisions): `getEventClaims.ts` unseals via
  auth-layer `server/utils/session.ts`; `applyEventClaims.ts` unchanged.
  (Landed follow-up: `session-refresh-pattern.md` grew the payload to `{ id, sid }` and moved
  validity to a server-side `auth.session` row — sliding lifetimes + revocation, issues
  0185/0180. Session lifetime stays fnb's domain; the ZITADEL scope contract is unchanged.)
- graphql-api-app, tenant-app, home-app, msg-app, storage-app: **no feature changes** (they only
  see the session cookie and GraphQL claims). The only thing they gained is the
  `NUXT_SESSION_SECRET` env (0010 — every session-parsing app unseals with it).

## Identity mapping (the crux)

Historically `auth.user.id === app.profile.id` (trigger `app_fn.handle_new_user()`); both the
table and the trigger are **dropped** at cutover. ZITADEL's `sub` is a numeric-string snowflake,
**not a uuid**, so it can never be the profile id. Mapping:

```
app.profile
  + idp_user_id text unique null    -- ZITADEL sub; null until first OIDC login
```

`app_fn.provision_idp_user(_idp_user_id text, _email citext, _display_name citext) returns app.profile`
(SECURITY DEFINER, `search_path = pg_catalog, public` — NOT `''`, which breaks citext operator
resolution; **no `app_api` exposure** — pre-claims root of trust, callable only via `db-access`
raw pg, granted to `authenticator`):

1. profile with `idp_user_id = _idp_user_id` exists → return it.
2. else profile with `email = _email` exists → set its `idp_user_id`, return it
   (covers every pre-existing/seeded user on their first ZITADEL login).
3. else create a new profile (`gen_random_uuid()`, display_name defaulting to
   `split_part(email,'@',1)`) with `idp_user_id`, and link pending invitations:
   `update app.resident set profile_id = ... where email = _email and status not in
   ('blocked_individual','blocked_tenant')` — the retired `handle_new_user` behavior.

Email-match provisioning trusts ZITADEL's `email_verified`; the callback rejects unverified emails.

## Login flow (as implemented)

```
browser → /auth/login  ── "Sign in with ZITADEL" ──►  GET /auth/api/auth/oidc/login
  auth-app: PKCE verifier + state in short-lived (10 min) httpOnly cookies, 302 →
${ZITADEL_ISSUER}/oauth/v2/authorize?client_id&redirect_uri&response_type=code
    &scope=openid email profile&code_challenge(S256)&state
  ZITADEL hosted login v1 (passkeys/MFA/social become config, not code; NOTE: first login
    per user shows a skippable "2-Factor Setup" prompt — default policy, re-shown per the
    720h MfaInitSkipLifetime)
    302 → GET /auth/api/auth/oidc/callback?code&state
  auth-app callback (server/api/auth/oidc/callback.get.ts):
    1. state check against the txn cookie; delete both txn cookies
    2. exchange code + verify id_token — openid-client v6 (JWKS/iss/aud), through the
       internal-URL transport (see below)
    3. fetch email / email_verified / name from USERINFO (robust regardless of the app's
       "userinfo inside id_token" assertion setting); reject unless email_verified === true
    4. profile = provisionIdpUser(sub, email, name)          [db-access, raw pg]
    5. sid = createSession(profile.id) [session-refresh-pattern.md]; deleteAuthCookies
       (legacy cleanup); setAppSession(event, { id: profile.id, sid })
       — the SEALED session cookie (0010), never raw JSON
    6. 302 → /auth/login?oidc=success — the login page hydrates claims (refreshClaims via
       GraphQL → localStorage) and runs the same residency-selection flow as before
```

Logout: the client POSTs `/api/auth/logout` (revokes the `auth.session` row + clears the sealed
session — `session-refresh-pattern.md`), then navigates to
`GET /api/auth/oidc/logout` — a **server route** that clears cookies again and 302s to
`${ZITADEL_ISSUER}/oidc/v1/end_session?client_id&post_logout_redirect_uri` (client_id variant —
we do not retain the id_token; the clientId stays server-side). Post-logout URI = stack home.

Library: `openid-client` v6 (auth-app Nitro; `oidc.None()` public client + PKCE) — never
hand-roll token exchange/JWKS.

**Split-horizon transport** (`apps/auth-app/server/utils/oidc.ts`, Decisions (a)): the browser
reaches ZITADEL at `NUXT_ZITADEL_ISSUER`; the container cannot. Server-side calls (token, JWKS,
userinfo) are rewritten to `NUXT_ZITADEL_INTERNAL_URL` while presenting the **external host in
the Host header** — ZITADEL resolves its instance from Host, and the id_token `iss` keeps
matching the external issuer. The rewrite rides **node:http, not fetch** — undici silently
strips a Host override (verified). Static endpoint metadata (no discovery call): avoids the
unreachable external discovery URL and a boot-order dependency on ZITADEL. The clientId is read
lazily at first use from the seed-volume handoff file (`NUXT_ZITADEL_SEED_FILE`).

## Infrastructure (implemented — compose is authoritative)

The canonical service documentation lives in `monorepo-bootstrap-pattern.md` → `zitadel` /
`zitadel-init` / `zitadel-seed`; `docker-compose.yml` is the source of truth. The
design constraints and hard-won gotchas:

- ZITADEL cannot live under an nginx **path prefix** (the issuer must own its origin; console
  and login assets are root-anchored) → own host port in dev (`${ZITADEL_HOST_PORT}`, like
  minio), **no nginx change**. Production later: own subdomain, TLS mode `external`, h2c
  upstream — see `.claude/skills/zitadel-expert/references/self-hosting.md`.
- Dedicated `zitadel` database inside the shared postgis container
  (`docker/db-init/10-create-zitadel-db.sh`, fresh-volume init; ZITADEL's admin-cred `init`
  self-heals if it's missing).
- **`zitadel-init`** one-shot chowns the `zitadel-seed` volume to uid 1000 first — the
  distroless image runs as `zitadel` (1000) and FirstInstance dies with EACCES writing the PAT
  onto a root-owned fresh volume.
- **Healthcheck is `/app/zitadel ready`** (distroless — no curl for `/debug/healthz`), and
  `ZITADEL_TLS_ENABLED: "false"` must be set in env: `ready` reads config from env only and
  never sees the `--tlsMode disabled` start flag — without it the probe checks https and the
  service is unhealthy forever.
- **Login v1 on v4**: `ZITADEL_DEFAULTINSTANCE_FEATURES_LOGINV2_REQUIRED: "false"` keeps the
  built-in hosted login (v1 is deprecated on v4, removed in v6 — revisit a login-v2 migration
  before upgrading past the v5 line). Self-registration disabled:
  `ZITADEL_DEFAULTINSTANCE_LOGINPOLICY_ALLOWREGISTER: "false"` (login-only posture).
- **Password complexity is relaxed** (`…PASSWORDCOMPLEXITYPOLICY_HASUPPERCASE/HASNUMBER/
  HASSYMBOL: "false"`, dev only) so ZITADEL seed users share `db/seed.sql`'s password.
- FirstInstance seeds org `fnb` + console human admin (`zitadel-admin` /
  `${ZITADEL_ADMIN_PASSWORD}`) + machine user `fnb-seeder` whose **PAT** lands on the shared
  volume (`ZITADEL_FIRSTINSTANCE_PATPATH`). Rebuild-wipes-volumes stays true: ZITADEL re-inits
  and re-seeds deterministically, same as the app DB.
- **`zitadel-seed`** one-shot (`docker/zitadel/seed.mjs` on `node:22-alpine`, PAT auth,
  idempotent): ensures project `fnb`; Web app `fnb-web` (auth method NONE/PKCE, Dev Mode,
  redirect `http://localhost:${PORT}/auth/api/auth/oidc/callback`, post-logout
  `http://localhost:${PORT}/`); dev human users mirroring `db/seed.sql` (same emails/password —
  ZITADEL owns credentials now); writes `{ issuer, clientId }` to the handoff file. Uses
  node:http with `Host: localhost` for the same undici reason as the transport above.

### Env additions (.env)

| Var | Example | Notes |
|---|---|---|
| `ZITADEL_HOST_PORT` | `8200` | host port for issuer + console |
| `ZITADEL_MASTERKEY` | 32 chars | immutable per volume-lifetime |
| `ZITADEL_DB_PASSWORD` | — | runtime db role |
| `ZITADEL_ADMIN_PASSWORD` | — | FirstInstance console human admin (`zitadel-admin`) |
| `NUXT_ZITADEL_ISSUER` | `http://localhost:8200` | external issuer: browser redirects + `iss` validation |
| `NUXT_ZITADEL_INTERNAL_URL` | `http://zitadel:8080` | auth-app→ZITADEL server-side calls (token/JWKS/userinfo) |
| `NUXT_ZITADEL_SEED_FILE` | `/zitadel-seed/fnb-web-app.json` | clientId handoff volume file |
| `NUXT_SESSION_SECRET` | ≥ 32 chars | sealed session cookie (issue 0010, landed with stage 3) — every session-parsing app |

## File inventory (as implemented)

| Layer | File | Change |
|---|---|---|
| compose | `docker-compose.yml` | + `zitadel`, `zitadel-init`, `zitadel-seed`, `zitadel-seed` volume; auth-app gains ZITADEL env + ro volume mount + seed dependency; all apps gain `NUXT_SESSION_SECRET` |
| db init | `docker/db-init/10-create-zitadel-db.sh` | fresh-volume `zitadel` database + role |
| seed job | `docker/zitadel/seed.mjs` | idempotent project/app/user seeding via PAT (node:http, Host spoof) |
| db | `db/fnb-app` `00000000010270_profile_idp_user` | `app.profile.idp_user_id` + `app_fn.provision_idp_user()` |
| db | `db/fnb-app` `00000000010280_drop_auth_user` | reworks `app_fn.profile_claims_for_user` (profile-id keyed, no auth.user join) + `app_fn.site_user_by_id` (authUser from app.profile); drops `on_auth_user_created`, `app_fn.handle_new_user`, `auth.login_user`, `auth.identities`, `auth.user`. Replay-safe on fresh DBs (create → drop) |
| db seed | `db/seed.sql` | profiles inserted directly into `app.profile` + resident linking (no auth.user path) |
| db-access | `src/mutations/provision-idp-user.ts` (+ barrel) | raw-pg call, camelCase + status/Date normalization, returns fnb-types `Profile`; `loginUser` deleted |
| fnb-types | `src/user.ts` | deleted (`User` was only consumed by `loginUser`) |
| auth-app | `server/utils/oidc.ts` | openid-client config singleton + internal-URL/Host-override transport |
| auth-app | `server/api/auth/oidc/login.get.ts` | PKCE+state cookies, 302 to authorize |
| auth-app | `server/api/auth/oidc/callback.get.ts` | exchange, verify, userinfo, email_verified gate, provision, sealed session, 302 `?oidc=success` |
| auth-app | `server/api/auth/oidc/logout.get.ts` | clears cookies, 302 end_session (client_id variant) |
| auth-app | `login.vue` / `profile.vue` | `?oidc=success` hydration + residency flow; ChangePasswordForm removed |
| auth-layer | `LoginForm.vue` | ZITADEL-button-only card (password form removed); `ChangePasswordForm.vue` deleted; `app/plugins/hydrate-claims.client.ts` already covered app-load hydration (since 2026-07-09 it *revalidates* stored claims on every boot — `claims-revalidation-pattern.md`) |
| auth-ui | `use-auth.ts` | + `loginWithRedirect()`; logout chains through the OIDC logout route; `login()`/`changePassword()` removed |
| decommissioned | `login.post.ts`, `change-password.post.ts`, `loginUser`, `auth.login_user`, `auth.user`, `auth.identities`, `handle_new_user` | all removed (closed issues `0070__auth______change-password-stub` and, with the sealed cookie, `0010__auth______session-cookie-signing`) |

## Spec/doc updates at cutover (R21) — done 2026-07-08/09

`CLAUDE.md` (auth model), `global-rules.md` R5, `graphql-api-pattern.md` (Auth Context + pre-claims
carve-out), `package-layers-pattern.md` (db-access + auth-layer inventories),
`monorepo-bootstrap-pattern.md` (services), `.claude/specs/auth-app/login.*`,
`profile.*`, `current-profile-claims.data.md`, reference docs `a5`/`c4` (historical banners),
`c6`/`e1` (updated), and the `fnb-stack-implementor` skill (`fnb-db-designer` had no stale
auth-table content).

## Decisions (Open Questions resolved with the user, 2026-07-08)

- [x] **Issuer host from inside containers** → **(a) internal URL override.** auth-app calls the
      token/JWKS endpoints via `http://zitadel:8080` (`NUXT_ZITADEL_INTERNAL_URL`) while `iss` is
      validated against the external issuer `http://localhost:${ZITADEL_HOST_PORT}`
      (`NUXT_ZITADEL_ISSUER`). No compose `extra_hosts`/alias tricks. (Implementation note: via
      node:http with a Host override — undici fetch strips it.)
- [x] **Hosted login v1** (zero extra services). On the v4 line, login v1 is deprecated — new
      instances default to login v2 and v1 is removed in v6 — so the instance is configured to
      keep v1 (`LOGINV2_REQUIRED: "false"`). Revisit a login-v2 migration before any upgrade past
      the v5 line; v2 later if brand fidelity demands it.
- [x] **Login-only — self-registration disabled**, mirroring the invite-only posture. Invite
      emails stay lazy (resident row `invited`; person logs in via ZITADEL; email match links).
      A profile with no residency lands in the existing "no active residency" flow.
- [x] **Session-cookie signing** (`0010`) landed **with** the stage-3 callback work — the
      callback never shipped the unsigned-cookie weakness. (0010 is closed/addressed.)
- [x] **Image pin: `ghcr.io/zitadel/zitadel:v4.15.3`** (current stable, released 2026-06-22).
