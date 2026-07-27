> **Execution Directive:** execute this plan via `/fnb-stack-implementor <this-file>`. Tasks in
> order; the verification phase is user-run (env rebuild) — the agent never restarts the env.

# Single-landing login + no MFA prompt

**Spec:** `.claude/specs/future-auth/zitadel-login-pattern.md` §Extension (Draft 2026-07-27) +
`.claude/specs/future-auth/README.md` (task list source) +
`.claude/specs/auth-app/login.ui.md` §Auto-redirect / `login.data.md` §Return-to step 1.

**What:** (1) `/auth/login` stops rendering the "Sign in with ZITADEL" button card and
auto-starts the OIDC ceremony, so the fnb-branded ZITADEL hosted login is the single landing
page. (2) The skippable "2-Factor Setup" prompt is removed by pinning the default login
policy's `MfaInitSkipLifetime` to 0.

**Verified code anchors (2026-07-27):**
- `apps/auth-app/app/pages/login.vue` — dispatcher target. Today: `isLoggedIn` → `goHome()`
  (top-level await), `onMounted` = setup gate (`/api/setup/status` → `/setup`) then
  `?oidc=success` return leg. Template: heading + `?welcome=1` `UAlert` + `<LoginForm />` +
  `<ResidencySelectModal>`.
- `packages/auth-ui/src/use-auth.ts:64` — `loginWithRedirect(returnTo?: string)` exists.
- `packages/fnb-types/src/return-to.ts:19` — `isSafeReturnTo` (barrel-exported).
- `docker/zitadel/seed.mjs:369-406` — `ensureLoginPolicy()` **already exists**
  (password-self-service, `hidePasswordReset: true`), already fetch-modify-write over
  `GET/PUT /admin/v1/policies/login`; line 394 currently passes `mfaInitSkipLifetime` through
  (`p.mfaInitSkipLifetime ?? '2592000s'`).
- `docker-compose.yml:271` — `ZITADEL_DEFAULTINSTANCE_LOGINPOLICY_ALLOWREGISTER: "false"` (the
  new env line goes beside it).
- `packages/auth-layer/app/components/LoginForm.vue` — **unchanged** (still used by
  `/auth/go/<id>`, the `welcome=1` pause, and the redirect-fallback state).

## Tasks

### Phase 1 — MFA prompt removal (infra)
- [x] **T1** `docker-compose.yml`: add
      `ZITADEL_DEFAULTINSTANCE_LOGINPOLICY_MFAINITSKIPLIFETIME: "0s"` directly under the
      `…LOGINPOLICY_ALLOWREGISTER` line (fresh-volume path; `DEFAULTINSTANCE_*` is
      FirstInstance-only).
- [x] **T2** (also applied to `infra/compose/docker-compose.prod.yml` — same DEFAULTINSTANCE
      block exists there) `docker/zitadel/seed.mjs` `ensureLoginPolicy()`: change the `mfaInitSkipLifetime`
      entry to the pinned `'0s'` (running-env path, self-heals every seed run); update the
      function's header comment and the success log to name both managed fields
      (`hidePasswordReset`, `mfaInitSkipLifetime`).

### Phase 2 — single landing page (auth-app)
- [x] **T3** `apps/auth-app/app/pages/login.vue`: auto-redirect dispatcher per
      `login.ui.md` §Auto-redirect. Gate order: (1) `isLoggedIn` → `goHome()` [existing];
      (2) setup gate → `/setup` [existing, stays ahead of redirect]; (3) `?oidc=success` →
      return leg [existing, never redirect]; (4) `?welcome=1` → pause: alert + explicit
      `<LoginForm />`, no auto-redirect; (5) otherwise →
      `loginWithRedirect(isSafeReturnTo(route.query.returnTo) ? route.query.returnTo : undefined)`.
      Template: redirecting state shows "Redirecting to sign-in…" (muted) with `<LoginForm />`
      as the manual fallback; the `welcome=1` pause keeps today's rendering.
- [x] **T4** Read-only confirmation done: consumers are `auth-app/index.vue` and `setup.vue`
      (both just `navigateTo('/login')` — auto-redirect is the desired behavior for them) and
      the go page's own `<LoginForm :return-to>` (untouched).
- [x] **T5** Gate: root `pnpm build` passed 2026-07-27 (13/13 turbo tasks).

### Phase 3 — optional hardening (deferrable; skip unless asked)
- [ ] **T6** seed.mjs: empty the default login policy's second-factor list (admin v1
      `ListLoginPolicySecondFactors` / `RemoveSecondFactorFromLoginPolicy` — verify exact
      paths first). `ensureLoginPolicy()`'s comment already notes the factor arrays are
      separate endpoints.

### Verify (user-run — agent never rebuilds/restarts the env)
- [ ] User runs the rebuild (`docker compose down && docker compose up`, or `pnpm env-rebuild`
      for the fresh-volume path that exercises T1).
- [ ] Sign-in shows exactly one page (fnb-branded ZITADEL hosted login); no button card.
- [ ] First login of a fresh user: no "2-Factor Setup" prompt.
- [ ] `?welcome=1`, `/auth/go/<id>`, `returnTo` round-trip, logout → login (no loop) all intact.
- [ ] `zitadel-seed` log line confirms the login-policy update applied.
