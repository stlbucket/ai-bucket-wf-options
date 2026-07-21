# 0500 — function-bucket brand rollout (favicons + login wordmark + ZITADEL branding)

> **Execution Directive:** execute this plan via
> `/fnb-stack-implementor .claude/issues/identified/0500__infra_____brand-identity-rollout__________LOW__.plan.md`.
> On completion, ask the user (yes/no) before moving this file to `.claude/issues/addressed/` (R23).

**Spec:** `.claude/specs/brand-identity/README.md`
**Handoff assets:** `.claude/design-implementations/design_handoff_fn_bucket_brand/assets/`
**Severity:** LOW (cosmetic, non-blocking) · **Category:** infra

## Summary

Roll the finished `> fn·bucket_` brand mark into every user-facing surface: favicons across all
apps (wired once in the root layer), the wordmark on our login card, and full ZITADEL hosted-login
branding (logo + green `#156f41` accent + dark variants). No DB / GraphQL / composable changes.

## Verified anchors

- `packages/auth-layer/nuxt.config.ts` — root layer config; **has no `app.head` block yet** (add one). All routed apps extend this transitively.
- `packages/auth-layer/app/components/LoginForm.vue` — the login card (`UCard`, header slot + "Sign in with ZITADEL" button). No logo today.
- `docker/zitadel/seed.mjs` — idempotent `node:http` seeder; JSON-only `api(method, path, body)` helper; `IS_PROD` gate; writes handoff JSON at the end.
- `docker-compose.yml` `zitadel-seed` service (L269–290) — mounts `./docker/zitadel/seed.mjs:/seed.mjs:ro` at L288; needs an assets mount added.
- Apps with a stale default `public/favicon.ico`: `apps/{auth,home,tenant}-app`.
- `agent-app` — headless, excluded.

---

## Phase 1 — Shared favicons (Surface A)

1. Create `packages/auth-layer/public/` and copy from the handoff `assets/`:
   `logo-light.png`, `logo-dark.png`, `icon-light-512.png`, `icon-512.png`,
   `apple-touch-icon-180.png`, `favicon-48.png`, `favicon-32.png`, `favicon-16.png`, `favicon.svg`.
2. Add an `app.head.link[]` block to `packages/auth-layer/nuxt.config.ts` (new key on the config):
   ```ts
   app: { head: { link: [
     { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
     { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' },
     { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon-180.png' },
   ] } },
   ```
   (Href paths are root-absolute; per-app `NUXT_APP_BASE_URL` rewrites them — verify in step-4 that
   the resolved URL includes the app prefix, e.g. `/tenant/favicon-32.png`.)
3. Resolve the stale `favicon.ico` (OQ-2): generate a brand `favicon.ico` from `favicon-48.png`
   into `packages/auth-layer/public/` and delete the three apps' default `public/favicon.ico`
   (fallback path), OR delete them and rely solely on the `<link>` tags. Pick one; note which.
4. **Verify:** `pnpm build` (the gate). Then confirm the tab icon on auth-app + one tenant-chain
   app resolves the brand PNG (view-source / network 200 on `…/favicon-32.png`).

## Phase 2 — Login wordmark (Surface B)

5. In `LoginForm.vue`, render the wordmark above the sign-in button, switching on color mode:
   - use `useColorMode()` (`@nuxtjs/color-mode`, already in the layer's optimizeDeps) — `logo-dark.png`
     when `colorMode.value === 'dark'`, else `logo-light.png`.
   - constrain width (e.g. `class="mx-auto h-10 w-auto"`), `alt="function-bucket"`; keep `UCard`/UC rules.
6. **Verify:** on the running auth-app login page, the wordmark shows correctly in light and dark.

## Phase 3 — ZITADEL hosted-login branding (Surface C)

7. `docker-compose.yml` `zitadel-seed`: add a read-only mount of the handoff assets beside the
   seed.mjs mount (L288), e.g.
   `- ./.claude/design-implementations/design_handoff_fn_bucket_brand/assets:/brand-assets:ro`,
   and pass a `BRAND_ASSETS_DIR: /brand-assets` env. (Confirm the path is inside the build context.)
8. Add `ensureBranding()` to `seed.mjs`, called after `ensureWebApp` and **before** the handoff-file
   write, in **both** SEED_MODEs (not gated on `IS_PROD`):
   - **Colors + flags** via the label policy (JSON): primary `#156f41`, `primaryColorDark` `#50986b`,
     `backgroundColor` `#f0f4f7`, `backgroundColorDark` `#0e1216`, `fontColor` `#1b2025`,
     `fontColorDark` `#eceff2`, `disableWatermark: true`, `themeMode` AUTO, `hideLoginNameSuffix: true`.
   - **Asset uploads** (logo light/dark, icon light/dark) — these are **multipart/form-data**, which
     the current JSON-only `api()` helper can't do. Add a small `upload(path, filePath, contentType)`
     helper that builds a multipart body over `node:http` (same Host-header + Bearer pattern).
   - **Activate** the label policy (preview → active).
   - Idempotent + fail-loud like the rest of seed.mjs (non-2xx ⇒ `process.exit(1)`; label policy is
     an upsert, re-running just re-applies).
9. **Resolve OQ-1 first (endpoint scope):** verify whether the seed PAT holds `IAM_OWNER`.
   - If yes → **instance** label policy: `PUT /admin/v1/policies/label`, uploads to
     `POST /assets/v1/instance/policy/label/{logo,logo/dark,icon,icon/dark}`,
     activate `POST /admin/v1/policies/label/_activate`. (Our authorize requests are **not**
     org-scoped, so instance branding is what the hosted login renders.)
   - If no → fall back to the **org** label policy (`/management/v1/policies/label` + org asset
     endpoints, already org-scoped via `x-zitadel-orgid`) **and** org-scope the authorize request in
     `apps/auth-app/server/utils/oidc.ts` (`scope += ' urn:zitadel:iam:org:id:' + orgId`) so the org
     branding shows. Prefer granting IAM_OWNER if it's clean; document the choice in the spec.
   - **→ skill `zitadel-expert`** (references `login-and-sessions.md`, and verify the exact v4.15.3
     label-policy + assets endpoint shapes against the running instance / API docs before coding).
10. **Verify (ask the user to rebuild — never self-rebuild):** after `docker compose down && up`,
    the ZITADEL login page shows the wordmark + green accent, no watermark, correct in light/dark.

## Phase 4 — Deferred (do not build now)

- JetBrains Mono TTF custom-font upload (OQ-3 — TTF not in handoff assets).
- Broader in-app header/sidebar logo beyond the login card (separate design pass).

---

## Cross-file sync (R21)

- Append a note to `.claude/specs/future-auth/zitadel-login-pattern.md` that `seed.mjs` now also
  applies instance branding (Surface C), so that spec stays in sync.
- Update `.claude/specs/brand-identity/README.md` task checkboxes + resolve OQ-1/OQ-2 as they land.

## Open questions carried from the spec

- **OQ-1** — seed PAT `IAM_OWNER`? (instance vs org policy path — resolved in Phase 3 step 9)
- **OQ-2** — real `favicon.ico` vs link-tags-only (resolved in Phase 1 step 3)
- **OQ-3** — JetBrains Mono TTF availability (deferred to Phase 4)

## Done when

Phases 1–3 verified; Phase 4 explicitly deferred; cross-file sync applied; spec README updated.
