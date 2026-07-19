# Plan: Adopt ZITADEL as the platform's authentication (login) provider — staged

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill (+ `fnb-db-designer` for
> the sqitch change, `zitadel-expert` for all ZITADEL config/API specifics).
> Invoke: `/fnb-stack-implementor .claude/issues/identified/0350__auth______zitadel-login-provider__________HI___.plan.md`
> Read `.claude/specs/future-auth/zitadel-login-pattern.md` (the contract) and
> `.claude/specs/future-auth/zitadel-replacement-analysis.md` (the why) in full first.
> Execute **one stage per session**; each stage ends with `pnpm build` green and its verification
> block satisfied. Gate is `pnpm build`. Never run `git`; never rebuild/restart Docker yourself —
> ask the user, then verify read-only.

**Severity: HIGH (feature)** · Workstream: WS3 (app auth) · Identified: 2026-07-08

## Goal

ZITADEL handles the login ceremony only. fnb consumes an authenticated `{ sub, email,
email_verified, name }`, maps it to `app.profile`, and sets the **same** httpOnly `session`
cookie `{ id: <profile uuid> }`. Licensing/permissions/residency/claims middleware
(`getEventClaims` → `app_fn.current_profile_claims`) are untouched. Full contract, file
inventory, env vars, and compose sketch live in the spec — this plan is the sequencing.

## Constraints discovered during analysis (do not re-derive)

- `auth.user.id === app.profile.id` today (trigger `app_fn.handle_new_user`). ZITADEL `sub` is a
  snowflake string, not a uuid → mapping column `app.profile.idp_user_id` + provisioning fn; the
  session cookie keeps carrying the **profile id**.
- ZITADEL cannot live under an nginx path prefix → dedicated host port in dev (like minio), no
  nginx change. Prod = subdomain + h2c (later, out of scope here).
- Masterkey (32 chars) is immutable after init. Rebuild-wipes-volumes stays true: FirstInstance
  steps + an idempotent seed job make ZITADEL state reproducible, including dev users mirroring
  the DB seed (super-admin `bucket@…`).
- Provisioning trusts `email_verified` only; unverified → 401 at the callback.

## Stages

### Stage 0 — Decisions (no code)
Confirm with the user the four Open Questions in the spec (internal-vs-external issuer URL
handling, hosted login v1 [recommended], self-registration off [recommended], image pin). Record
answers in the spec (Mode 3), flip its status when none remain.

### Stage 1 — Infra: ZITADEL in docker compose
1. `.env(.example)`: `ZITADEL_HOST_PORT`, `ZITADEL_MASTERKEY`, `ZITADEL_DB_PASSWORD`,
   `NUXT_ZITADEL_ISSUER`, `NUXT_ZITADEL_SEED_FILE`.
2. `docker-compose.yml`: `zitadel` service (pinned image, `start-from-init --masterkeyFromEnv
   --tlsMode disabled`, env per spec, own host port, healthcheck `/debug/healthz`, depends on
   `db` healthy) reusing the postgis container with a dedicated `zitadel` database
   (fresh-volume init script under `docker/`); FirstInstance steps seed org + admin + machine
   user PAT onto a named volume.
3. `zitadel-seed` one-shot service: idempotent script (PAT auth) ensuring project `fnb`; Web app
   auth-method NONE (PKCE) + Dev Mode, redirect `http://localhost:${PORT}/auth/api/auth/oidc/callback`,
   post-logout `http://localhost:${PORT}/`; dev human users matching DB seed users; writes
   `{ issuer, clientId }` JSON to the shared volume.
4. **User rebuilds/starts the stack** (never do it yourself).

**Verify (read-only):** `curl http://localhost:${ZITADEL_HOST_PORT}/.well-known/openid-configuration`
returns the issuer; console loads; seed volume contains the JSON; `docker compose ps` all healthy;
existing password login still works (nothing app-side changed yet).

### Stage 2 — DB + db-access: identity mapping
1. sqitch change in `db/fnb-app` (use `sqitch-expert`; deploy+revert+verify): add
   `app.profile.idp_user_id text unique`; add `app_fn.provision_idp_user(_idp_user_id,_email,_display_name)
   returns app.profile` — SECURITY DEFINER, empty search_path, schema-qualified, **no `app_api`
   wrapper** (pre-claims root of trust, R5 carve-out); logic = lookup by idp_user_id → link by
   email → create + link pending residents (mirror `handle_new_user`), per spec.
2. `packages/db-access`: `src/mutations/provision-idp-user.ts` (`to_jsonb` + `camelCaseKeys`
   pattern like `current-profile-claims.ts`), barrel export.

**Verify:** deploy on dev DB (sqitch session — no git); `select app_fn.provision_idp_user('123','bucket@…',null)`
links the existing seeded profile (row now has idp_user_id); calling again returns same row;
brand-new email creates a profile and adopts `invited` residents; `pnpm build` green.

### Stage 3 — auth-app: OIDC login/callback (parallel-run)
1. Add `openid-client` to auth-app. Server routes per spec:
   `server/api/auth/oidc/login.get.ts` (PKCE verifier + state in short-lived httpOnly cookies,
   302 to `/oauth/v2/authorize`) and `server/api/auth/oidc/callback.get.ts` (state check, code
   exchange, id_token verification, `email_verified` gate, `provisionIdpUser`, `deleteAuthCookies`
   + set `session` `{ id: profile.id }`, 302 home). Respect the stage-0 decision on
   internal-vs-external issuer URLs.
2. Login page/`LoginForm`: add "Sign in with ZITADEL" **alongside** the password form
   (parallel-run; cutover is stage 5).
3. `auth-ui` `use-auth.ts`: add `loginWithRedirect()`; on app load, if session cookie exists and
   localStorage user is null → `refreshClaims()` (post-redirect hydration); logout additionally
   navigates to `/oidc/v1/end_session?client_id&post_logout_redirect_uri` after the existing POST.
4. Coordinate with `0010__auth______session-cookie-signing__________CRT__` — if unaddressed, flag
   to the user that the new callback inherits the unsigned-cookie weakness; do not silently fix.

**Verify:** ZITADEL button → hosted login → callback → landed logged-in with correct
`ProfileClaims` in localStorage (same tenant/permissions as password login for the same user);
`app.profile.idp_user_id` populated; password login still works; logout ends both sessions
(re-clicking Sign in prompts for credentials); `pnpm build` green.

### Stage 4 — invited-user + no-residency paths
1. E2E through ZITADEL: seeded-but-never-logged-in user (email match links), fresh user with a
   pending `invited` resident row (residency adoption → residency-selection flow), fresh user with
   no residency (lands in the existing no-active-residency flow).
2. No code expected beyond fixes these flows shake out; claims middleware must remain untouched.

**Verify:** the three paths above behave per `auth-app/login.data.md`'s residency section; support
mode (`exitSupport`) and residency switching still work under an OIDC-established session.

### Stage 5 — cutover + decommission + docs (R21)
1. Remove: password form; `login.post.ts`; `change-password.post.ts` (+ `changePassword` from
   auth-ui and `ChangePasswordForm.vue`) — **supersedes/closes
   `0070__auth______change-password-stub____________HI___`** (password mgmt is ZITADEL
   self-service now); `loginUser` from db-access; sqitch change dropping `auth.login_user`,
   the `on_auth_user_created` trigger + `handle_new_user`, then `auth.identities` and `auth.user`
   (check `app_fn_support.sql` reads `auth.user` — rework that view/function too; grep first).
2. DB seed: seeded profiles are created directly in `app.profile` (no auth.user path anymore) with
   the zitadel-seed job owning credentials.
3. Docs in the same change (R21): `monorepo-bootstrap-pattern.md`, `graphql-api-pattern.md`
   security section, `.claude/specs/auth-app/login.*` + `current-profile-claims.*` (Mode 3),
   `global-rules.md` if it names `auth.login_user`, both fnb skills; move this plan file only
   after asking the user (per memory: ask before moving to addressed/).

**Verify:** full rebuild by the user → login via ZITADEL as `bucket@…` works, tenant users can be
invited and log in; no references to `auth.user`/`loginUser` remain (`grep -rn`); `pnpm build`
green; issues 0010/0070/0180 statuses reviewed with the user.

## Explicit non-goals (this plan)
Tenants-as-orgs, per-tenant SSO/IdPs, customer sub-scope, login v2 container, production
subdomain/TLS topology, MFA/passkey policy tuning — all future work; see the analysis doc.
