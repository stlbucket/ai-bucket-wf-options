> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `docs/issues/` plan file (R23) from the task list below,
> then executes it.

# future-auth — ZITADEL auth pattern specs

## Status
Core pattern **Implemented** (ZITADEL cutover complete 2026-07-09; sessions + claims
revalidation landed after). Extension (single-landing login + MFA-prompt removal):
**Implemented — user-verified on a rebuilt env 2026-07-27** (plan
`0590__auth______single-landing-login-no-mfa`, addressed). Phase 3 (second-factor list
purge) remains optional/deferred. Known cosmetic note: a brief flash of the fnb login card
before the redirect lands on ZITADEL — structural (onMounted redirect + setup-status fetch),
worse in dev; user accepted as-is (delay-the-fallback-button polish was offered and declined).

## Purpose
ZITADEL owns the login ceremony (OIDC code+PKCE, hosted login v1); fnb owns everything after
the identity handoff (profile mapping, sealed session cookie, claims, residency, RLS). These
files record that contract and its follow-on patterns. The 2026-07-27 extension collapses the
sign-in UX to a single landing page (auto-redirect past fnb's button card straight into the
fnb-branded hosted login) and removes the 2FA setup prompt from the ceremony.

## Files in this spec

| File | What it covers | Status |
|---|---|---|
| `zitadel-login-pattern.md` | The OIDC login contract: identity mapping, flow, infra, env, **§Extension (single landing + no MFA)** | Implemented (extension verified 2026-07-27) |
| `session-refresh-pattern.md` | Server-side `auth.session` rows: sliding lifetimes + revocation | Implemented |
| `claims-revalidation-pattern.md` | Stored-claims revalidation on every app boot | Implemented |
| `zitadel-replacement-analysis.md` | Scenario analysis that selected the login-provider approach | Historical |

Companion page specs updated with the extension: `docs/specs/auth-app/login.ui.md`
(auto-redirect dispatcher) and `login.data.md` (§Return-to threading note).

## Locked decisions (extension 2026-07-27)

| Decision | Why |
|---|---|
| Single landing page = **auto-redirect** from `/auth/login` into hosted login v1 | The extra page is fnb's own button card, not ZITADEL's; hosted login is already fnb-branded (plan 0500). Zero new services, smallest diff. |
| `LoginForm.vue` **unchanged**; stays as manual fallback + explicit button on `?welcome=1` and `/auth/go/<id>` | The go page shows item context before sign-in; the welcome pause keeps the post-invitation confirmation readable; a fallback button survives blocked redirects. |
| Setup gate stays **ahead of** the auto-redirect | A virgin env must land on `/auth/setup`, never on an empty ZITADEL login (first-run-setup spec). |
| No-2FA = **`MfaInitSkipLifetime: 0s`** on the default login policy | Purpose-built ZITADEL knob: 0 disables the MFA-init prompt entirely; users then never enroll a factor, so no challenge can appear. `ForceMFA` already false. |
| Applied in **both** compose env and `seed.mjs` `ensureLoginPolicy()` | `DEFAULTINSTANCE_*` env only takes effect at FirstInstance creation (fresh volume); the idempotent seed update fixes running envs and self-heals every seed run. `ensureLoginPolicy()` already exists (password-self-service's `hidePasswordReset`) and already does the required fetch-modify-write — this is a one-field extension, not a new function. |

## Implementation Task List

**Phase 1 — MFA prompt removal (infra)**
- [x] `docker-compose.yml` **and** `infra/compose/docker-compose.prod.yml`: added
      `ZITADEL_DEFAULTINSTANCE_LOGINPOLICY_MFAINITSKIPLIFETIME: "0s"` next to the existing
      `…LOGINPOLICY_ALLOWREGISTER` key
- [x] `docker/zitadel/seed.mjs`: extend the **existing** `ensureLoginPolicy()` (already does
      fetch-modify-write for `hidePasswordReset`) — pin `mfaInitSkipLifetime: '0s'` instead of
      passing the current value through; update its comment + success log

**Phase 2 — single landing page (auth-app)**
- [x] `apps/auth-app/app/pages/login.vue`: auto-redirect dispatcher per
      `auth-app/login.ui.md` §Auto-redirect — gates: `isLoggedIn` → home; `needsSetup` →
      `/setup`; `?oidc=success` → return leg; `?welcome=1` → pause (alert + button); else
      `loginWithRedirect(returnTo?)` with `isSafeReturnTo`-validated `route.query.returnTo`
- [x] Redirecting state: "Redirecting to sign-in…" + `<LoginForm>` manual fallback
- [x] Confirm `/auth/go/<id>` and `?welcome=1` flows are untouched (LoginForm unchanged)

**Phase 3 — optional hardening (deferrable)**
- [ ] seed.mjs: empty the second-factor list on the default login policy (admin v1
      `ListLoginPolicySecondFactors` / `RemoveSecondFactorFromLoginPolicy` — verify exact
      paths at implementation time)

**Verify (user-run rebuild — never agent-run)**
- [x] Fresh rebuild verified by the user 2026-07-27: sign-in shows exactly one page
      (fnb-branded ZITADEL login); no 2FA-setup prompt; flows intact

## Remaining Open Questions
None — Phase 3 is scoped as optional/deferrable, not open.

## Considered & rejected

- **Login v2 (self-hosted Next.js fork)** — full layout control, but a new service to run and
  passkey/domain migration risk; both asks are satisfiable with v1 + policy config. Revisit
  only with the already-noted v5-line upgrade (v1 is removed in v6).
- **Session API custom login UI** — maximum control, maximum owned attack surface (lockout,
  MFA ordering, bot protection); wildly out of proportion to the ask.
- **Deleting `/auth/login` and linking `/oauth/v2/authorize` directly from apps** — the page
  owns the return leg (claims hydration + residency selection) and the setup/welcome gates;
  it must stay, it just stops rendering a button.
