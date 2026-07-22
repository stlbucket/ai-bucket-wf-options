# Plan: First-run setup — bootstrap a virgin env from `/auth/setup` (empty-env path)

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill (+ `fnb-db-designer` /
> `sqitch-expert` for the DB change, `zitadel-expert` for the ZITADEL management-API specifics).
> Invoke: `/fnb-stack-implementor <this plan file>` (this plan is the durable entry point; it names
> *this file*, not a hardcoded `identified/…` path, so it survives moves/renumbering).
> Read the four spec files first — `.claude/specs/first-run-setup/{README,_shared.data,setup.ui,setup.data,infrastructure}.md`
> are the source of truth; this plan is only the sequencing.
> Execute **one stage per session**; each stage ends with `pnpm build` green and its Verify block
> satisfied. Gate is `pnpm build` (repo-wide `pnpm lint` is known-broken). **Never run `git`**;
> **never rebuild/restart Docker yourself — ask the user, then verify read-only.**

**Severity: MED (feature)** · Workstream: app bootstrap · Identified: 2026-07-21 · Spec:
`.claude/specs/first-run-setup/` (status **Ready**, all `[FILL IN]` resolved 2026-07-21)

## Goal

Give an empty environment (schema deployed, **no seed data beyond the app-install path** — no
anchor tenant, no profiles, no ZITADEL user roster) a human-driven first-run flow: on first open
the site routes the visitor to **`/auth/setup`**, where they name the first tenant + first user.
That reuses the existing anchor bootstrap wholesale (`app_fn.create_anchor_tenant`) behind a thin,
gated, **pre-claims** carve-out (raw pg + Nitro, no GraphQL — the same posture as the OIDC login
trio), seeds the matching ZITADEL human user via the seeder PAT, and auto-redirects into the
ZITADEL OIDC login. A second dev entry point `pnpm env-build-empty` stands up the seedless stack;
the existing `env-build` stays byte-for-byte intact.

## Locked decisions (from the spec Q&A — do not re-derive; see README "Resolved Decisions")

- **No GraphQL surface.** All DB access is `db-access` raw pg (R5 carve-out); ZITADEL via seeder
  PAT. No codegen, no composable, no `.graphql` docs.
- **Host = auth-app** (`/auth/setup`) — already the pre-claims carve-out, owns the ZITADEL
  transport + mounts the `zitadel-seed` PAT volume.
- **Password policy** — client-side pre-filter (≥ 8 chars, ≥ 1 number, ≥ 1 symbol) **and** ZITADEL
  rejection surfaced verbatim (422); ZITADEL stays source of truth.
- **`changeRequired: false`** on the seeded ZITADEL user.
- **`SETUP_TOKEN` mandatory in every env** (dev included). The `initialize` endpoint fails **closed**
  when unset (500), compares **constant-time** (`crypto.timingSafeEqual`), and gates **before**
  ZITADEL/DB (403 on mismatch). Form collects a Setup-token field; empty-env build supplies it.
- **Post-success = auto-redirect into OIDC** (`useAuth().loginWithRedirect()`), no interim card.
- **`env-rebuild-empty` included**; `isPortFree` **duplicated** into `env-build-empty.ts` (keeps
  `env-build.ts` untouched).
- Reused as-is (no changes): `app_fn.create_anchor_tenant`/`install_anchor_application`/`invite_user`/
  `assume_residency`, `app_fn.provision_idp_user` (first OIDC login links the profile by email),
  the `db-access` raw-pg root-of-trust pattern, the ZITADEL `node:http` + Host-spoof transport.

## Verified code anchors (as of 2026-07-21)

- New fnb-app sqitch change lands after `db/fnb-app/deploy/00000000010290_session.sql` →
  `00000000010300_app_fn_initialize_anchor` (depends on `00000000010290_session`).
- `app_fn.create_anchor_tenant` — `db/fnb-app/deploy/00000000010240_app_fn.sql`.
- Pre-claims root-of-trust template — `db/fnb-app/deploy/00000000010270_profile_idp_user.sql`
  (`app_fn.provision_idp_user`) + `packages/db-access/src/mutations/provision-idp-user.ts`
  (`to_jsonb` + `camelCaseKeys`); db-access barrel `packages/db-access/src/index.ts`; query dir
  `packages/db-access/src/queries/`.
- auth-app carve-out: `apps/auth-app/server/api/auth/oidc/{login,callback,logout}.get.ts` +
  `apps/auth-app/server/utils/oidc.ts` (node:http + Host header); pages
  `apps/auth-app/app/pages/{index,login,profile}.vue`; `zitadel-seed:/zitadel-seed` volume already
  mounted on auth-app (docker-compose.yml); PAT at `/zitadel-seed/admin.pat`.
- `useAuth().loginWithRedirect()` / `refreshClaims()` — `packages/auth-ui/src/use-auth.ts`.
- Empty-env infra targets: `docker/migrate-entrypoint.sh`, `docker/zitadel/seed.mjs`,
  `scripts/{_env,env-build,env-destroy}.ts`, root `package.json`, `docker-compose.yml`.

---

## Stages

### Stage 1 — DB (fnb-app, new sqitch change) → `fnb-db-designer` + `sqitch-expert`
1. New change `00000000010300_app_fn_initialize_anchor` in `db/fnb-app` (deploy+revert+verify;
   depends on `00000000010290_session`). Sqitch session = **never run `git`**.
2. `app_fn.anchor_exists()` — `STABLE SECURITY DEFINER sql`, `exists(select 1 from app.tenant
   where type='anchor')`; `GRANT EXECUTE … TO authenticator`.
3. `app_fn.initialize_anchor(_tenant_name, _email, _display_name, _first_name, _last_name, _phone)`
   `RETURNS app.profile` — `SECURITY DEFINER`, `SET search_path = pg_catalog, public` (**not** `''`
   — citext operator resolution), **no `app_api` wrapper**, granted only to `authenticator`. Body
   per `_shared.data.md`: hard `SETUP_ALREADY_COMPLETE` gate (errcode `42501`) →
   `create_anchor_tenant` → insert `app.profile` → link the superadmin resident → `assume_residency`.
4. Deploy on the **empty** dev DB; confirm the gate + grants.

**Verify:** `sqitch deploy`/`revert`/`verify` all green (no git). On a virgin DB
`select app_fn.anchor_exists()` → `false`; `select app_fn.initialize_anchor('Acme','a@b.co',…)`
creates the anchor tenant + one `app-admin-super` profile + active residency; a **second** call
raises `SETUP_ALREADY_COMPLETE`; `anchor_exists()` → `true`. `pnpm build` green.

### Stage 2 — db-access (raw-pg carve-out)
1. `packages/db-access/src/queries/anchor-exists.ts` → `anchorExists(): Promise<boolean>`
   (`select app_fn.anchor_exists() as exists`).
2. `packages/db-access/src/mutations/initialize-anchor.ts` → `initializeAnchor(input:
   InitializeAnchorInput): Promise<Profile>` (`select to_jsonb(app_fn.initialize_anchor($1..$6))`,
   `camelCaseKeys` + `profileStatus` uppercase + `Date` normalization per R3) + co-located
   `InitializeAnchorInput` type. Mirror `mutations/provision-idp-user.ts`.
3. Add both to the barrel `src/index.ts` (**the #1 miss** — a missing barrel line is a runtime ESM
   crash, not a build error). `pnpm -F @function-bucket/fnb-db-access build`.

**Verify:** package builds clean; barrel exports both symbols (`grep`); a scratch node import
resolves `anchorExists` / `initializeAnchor`. `pnpm build` green.

### Stage 3 — auth-app server (endpoints + ZITADEL admin + SETUP_TOKEN gate) → `zitadel-expert`
1. `apps/auth-app/server/utils/zitadel-admin.ts` — PAT management client reusing the `oidc.ts`
   transport (**`node:http`** against `NUXT_ZITADEL_INTERNAL_URL`, external host from
   `NUXT_ZITADEL_ISSUER` in the `Host` header; **reuse the existing `NUXT_ZITADEL_*` names — no new
   alias vars**). PAT read from `ZITADEL_PAT_FILE` (`/zitadel-seed/admin.pat`). Exports
   `createHumanUser({email,givenName,familyName,password})` → `POST /v2/users/human` with
   `email.isVerified:true`, `password.changeRequired:false`; 409/"already exists" → `{created:false}`
   (idempotent); resolves org via `GET /management/v1/orgs/me` (cached).
2. `apps/auth-app/server/api/setup/status.get.ts` → `{ needsSetup: !(await anchorExists()) }`
   (unauthenticated, read-only; **no** token required).
3. `apps/auth-app/server/api/setup/initialize.post.ts` — handler order: (0) **SETUP_TOKEN gate** —
   fail closed 500 `SETUP_NOT_CONFIGURED` if `process.env.SETUP_TOKEN` empty; `timingSafeEqual`
   (guard unequal lengths) → 403 `INVALID_SETUP_TOKEN` on mismatch; (1) soft `anchorExists()` gate →
   409; (2) `createHumanUser` (422 `ZITADEL_REJECTED` verbatim on complexity reject, 502
   `ZITADEL_UNAVAILABLE` on PAT/transport failure); (3) `initializeAnchor` (409 on the hard-gate
   race, 500 `DB_ERROR`); (4) `{ ok: true }`. ZITADEL-first for safe retry.
4. auth-app compose service env: add `ZITADEL_PAT_FILE: "/zitadel-seed/admin.pat"` and
   `SETUP_TOKEN: "${SETUP_TOKEN:?…}"` (required). Reuse existing `NUXT_ZITADEL_*`; no alias vars.

**Verify (read-only after the user restarts):** `GET /auth/api/setup/status` → `{needsSetup:true}`
on empty env. `POST /auth/api/setup/initialize` with a wrong token → **403** before any ZITADEL/DB
call; unset server token → **500 SETUP_NOT_CONFIGURED**; a bad password → **422** with ZITADEL's
message; a valid submit → `{ok:true}` + creates the ZITADEL human user (changeRequired false) and
the anchor tenant/profile. `pnpm build` green.

### Stage 4 — auth-app UI (`/auth/setup`)
1. `apps/auth-app/app/pages/setup.vue` — `UCard` mirroring `login.vue` (`FunctionBucketMark`); the
   `UForm`/`UFormField` fields from `setup.ui.md` **including the required Setup-token field**;
   reactive `form` incl. `setupToken`; client validation (required + email shape + pw===confirm +
   complexity ≥ 8/number/symbol + token present) disables submit. Mount gate: `GET
   …/setup/status`; `needsSetup===false` → `navigateTo('/auth/login',{replace:true})`. Errors →
   persistent `UAlert color="error"` (UC7); handle 403/409/422/4xx per the interactions table.
2. Login-page gate: in `login.vue` (or a tiny auth-app route middleware) redirect
   `/auth/login → /auth/setup` when `needsSetup===true`. **No home-app change** (hero copy stays).
3. Success path: success toast → **`useAuth().loginWithRedirect()`** (auto-redirect into OIDC).

**Verify (read-only):** on empty env, opening the site / hitting `/auth/login` lands on
`/auth/setup`; submitting (with the `.env` `SETUP_TOKEN`) creates everything and redirects straight
into the ZITADEL OIDC login; after setup, `/auth/setup` bounces to `/auth/login`. Icons render
(UC11), no console errors. `pnpm build` green.

### Stage 5 — empty-env infrastructure (`SEED_DATA` + `env-build-empty`)
1. `docker-compose.yml`: `SEED_DATA: "${SEED_DATA:-full}"` on `db-migrate` **and** `zitadel-seed`.
2. `docker/migrate-entrypoint.sh`: guard the `db/seed.sql` step (`SEED_DATA=empty` → skip; roles +
   sqitch deploy unchanged).
3. `docker/zitadel/seed.mjs`: gate **only** the user-roster loop
   (`SEED_USERS_ENABLED = (SEED_DATA ?? 'full') !== 'empty' && !IS_PROD`); keep
   `ensureProject`/`ensureWebApp`/`ensureBranding` + the `{issuer,clientId}` handoff.
4. `scripts/env-build-empty.ts` — mirror `env-build.ts` (**duplicate** `isPortFree`), set
   `SEED_DATA:'empty'` in the compose child env; **do not touch `env-build.ts`**.
5. Root `package.json`: `env-build-empty` + `env-rebuild-empty`
   (`env-destroy && env-build-empty`).
6. `.env` / `.env.example`: add `SETUP_TOKEN` (generated, e.g. `openssl rand -hex 24`) — required
   in every env.

**Verify (user runs `pnpm env-destroy && pnpm env-build-empty`):** `db-migrate` logs "skipping
db/seed.sql"; `zitadel-seed` logs project/app/branding but **no** user creations; `select count(*)
from app.tenant` → 0, `app.profile` → 0; ZITADEL has only FirstInstance users. Then the Stage-4
smoke completes the anchor. `pnpm env-build` (default) still seeds the full roster (unchanged).

### Stage 6 — spec/doc sync (R21)
1. Note the new pre-claims carve-out where the OIDC trio is documented
   (`graphql-api-pattern.md` security section and/or `future-auth/zitadel-login-pattern.md`).
2. `monorepo-bootstrap-pattern.md`: document `SEED_DATA` + `env-build-empty`/`env-rebuild-empty`.
3. `CLAUDE.md` Root Scripts: add `env-build-empty`.
4. Flip the spec dir's remaining status notes if any; move **this plan** to `addressed/` **only
   after** the completion hand-off question (R23 — status is the directory, filename unchanged).

**Verify:** the three doc touch-points mention the carve-out + empty-env scripts; `grep` finds
`SEED_DATA` / `env-build-empty` in `monorepo-bootstrap-pattern.md` + `CLAUDE.md`. `pnpm build`
green.

## Explicit non-goals (this plan)
Replacing the fat dev seed; a prod/internet-exposed hardening pass beyond the mandatory
`SETUP_TOKEN`; multi-tenant/self-registration; any GraphQL surface for setup; home-app hero copy
changes; ZITADEL org/project topology changes (reuses the existing FirstInstance org + web app).
