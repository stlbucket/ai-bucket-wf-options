# brand-identity: function-bucket brand rollout (favicons + login wordmark + ZITADEL branding)

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor .claude/specs/brand-identity/README.md`
> — the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
**Implemented** (plan `0500`, verified 2026-07-20) — Phases 1–3 shipped and verified on a full env
rebuild: favicons serve 200 across apps, the login wordmark renders, and the ZITADEL hosted login
shows the brand logo + green accent (seed branding exited 0, policy activated). Phase 4 deferred.
OQ-1 resolved to the **instance** path (FirstInstance machine user holds `IAM_OWNER` — no 403);
OQ-2 resolved (brand `favicon.ico` in the layer + stale app defaults removed).

## Purpose

Roll the finished **function-bucket** brand mark (design handoff
`.claude/design-implementations/design_handoff_fn_bucket_brand/`, direction *2b "The Prompt"*)
into every user-facing surface of the stack:

- **Surface A — Nuxt apps:** favicons + apple-touch-icon across all routed apps, wired once in the
  shared root layer so every app inherits them.
- **Surface B — our login page:** the `> fn·bucket_` wordmark on the auth-app login card
  (the page that carries the "Sign in with ZITADEL" button).
- **Surface C — the ZITADEL hosted login:** logo + brand colors + dark-mode variants applied to
  the instance label policy, so the redirect target of the OIDC ceremony matches our theme instead
  of showing default ZITADEL branding. This absorbs the earlier "customize the ZITADEL login page"
  request — with the real logo, not colors-only.

The mark is a terminal wordmark: `>` prompt glyph (forest green), `fn·bucket` ink, `_` cursor
(cascadia blue), plus an "fn" rounded-square icon (blue-900 bg, green-300 glyph). Font is
JetBrains Mono 700 (already the repo's `--font-mono`).

## Assets (production-ready, in the handoff `assets/` dir)

All PNGs are well under ZITADEL's **0.5 MB** upload cap (largest is 18 KB).

| File | Use |
|---|---|
| `logo-light.png` (1228×384) | wordmark on light backgrounds (login card, ZITADEL light theme) |
| `logo-dark.png` (1228×384, transparent) | wordmark on dark backgrounds |
| `icon-light-512.png` / `icon-512.png` | "fn" icon masters (light / dark) — ZITADEL icon (console/compact) |
| `apple-touch-icon-180.png` | iOS home-screen icon |
| `favicon-48.png` / `favicon-32.png` / `favicon-16.png` | browser favicons |
| `favicon.svg` | vector icon — **do not ship to ZITADEL** (rejects SVG) and note the font caveat below |

⚠ `favicon.svg`'s "fn" text renders correctly only where JetBrains Mono is available. Prefer PNGs
wherever the font isn't guaranteed. ZITADEL **rejects SVG and caps uploads at 0.5 MB** — use PNGs.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Where favicon assets live | `packages/auth-layer/public/` + head links in `packages/auth-layer/nuxt.config.ts` | `auth-layer` is the **universal root** of the layer chain — every routed app extends it transitively (auth-app→auth-layer; all others→…→tenant-layer→auth-layer). One source, all apps inherit. No per-app duplication. |
| Accent (ZITADEL primary) color | **green `#156f41`** (green-600) | Handoff spec, verbatim. It is the prompt-glyph brand color. (Supersedes the earlier "blue vs green" question — the brand answers it.) |
| ZITADEL colors | primary `#156f41`; background light `#f0f4f7` / dark `#0e1216`; font light `#1b2025` / dark `#eceff2` | Handoff "ZITADEL branding" section, verbatim. |
| ZITADEL `primaryColorDark` | **`#50986b`** (green-400) | Handoff gives one primary; green-400 is its own token-table value for the prompt glyph *on dark backgrounds* (matches `logo-dark.png`). Theme-consistent derivation, not a guess. |
| ZITADEL logo/icon per theme | logo: `logo-light.png` (light) / `logo-dark.png` (dark); icon: `icon-light-512.png` (light) / `icon-512.png` (dark) | Handoff mapping. |
| How ZITADEL branding is applied | extend the idempotent **`docker/zitadel/seed.mjs`** with an `ensureBranding()` step (colors+flags JSON → asset uploads → activate) | House pattern: instance config lives in seed.mjs and re-runs every `compose up`. Not the `ZITADEL_DEFAULTINSTANCE_LABELPOLICY_*` env path (fires only on fresh-volume FirstInstance; logos there need externally-reachable URLs). |
| Branding runs in dev **and** prod | `ensureBranding()` is **not** gated on `IS_PROD` | Branding is not dev-only seed data; both modes get the themed login. (Contrast: dev-user seeding is dev-only.) |
| `disableWatermark` | **true** | Self-hosted is permitted to remove "Powered by ZITADEL"; makes it read as our own page. |
| `themeMode` | **AUTO** | Follows the visitor's system light/dark, matching our app's color-mode behavior. |
| agent-app | **excluded** | Headless, no user pages / no `<head>` — nothing to brand. |

## Files in this spec

Surface A/B touch app + layer source; Surface C touches the seed script + compose. Nothing in
the data stack (no DB / GraphQL / composables) changes.

| Path | Change |
|---|---|
| `packages/auth-layer/public/*` | **new** — copy the handoff PNGs (+ `favicon.svg`) here |
| `packages/auth-layer/nuxt.config.ts` | add `app.head.link[]` (favicons + apple-touch-icon) |
| `apps/{auth,home,tenant}-app/public/favicon.ico` | replace/remove the stale default Nuxt icon (see OQ-2) |
| `packages/auth-layer/app/components/LoginForm.vue` | render the wordmark logo, color-mode-aware |
| `docker/zitadel/seed.mjs` | add `ensureBranding()` — label-policy colors/flags, asset uploads, activate |
| `docker-compose.yml` (`zitadel-seed` service) | mount the brand `assets/` dir into the container so seed can upload them |
| `.claude/specs/future-auth/zitadel-login-pattern.md` | append a note that seed now also applies instance branding (keep specs in sync, R21) |

## Implementation Task List

### Phase 1 — Shared favicons (Surface A)
- [x] Copy `logo-*.png`, `icon-*-512.png`, `apple-touch-icon-180.png`, `favicon-{16,32,48}.png`,
      `favicon.svg` from the handoff `assets/` into `packages/auth-layer/public/`
- [x] Add `app.head.link[]` in `packages/auth-layer/nuxt.config.ts` (32/16 png icons +
      apple-touch-icon), per the handoff's Nuxt-wiring snippet
- [x] Resolve the stale `public/favicon.ico` (OQ-2): generated a brand `favicon.ico` (PNG-in-ICO
      from `favicon-48`) in `auth-layer/public/`; deleted the identical default `.ico` from
      auth/home/tenant apps so the layer icon is served everywhere
- [x] `pnpm build` gate — auth-app built clean; runtime tab-icon check pending env rebuild

### Phase 2 — Login wordmark (Surface B)
- [x] In `LoginForm.vue`, show `logo-light.png` / `logo-dark.png` above the sign-in button,
      switching on color mode (`useColorMode`); `h-8 w-auto`, `alt="function-bucket"`
- [x] Verified on the running auth-app login page (logo serves 200; rendered on login card)

### Phase 3 — ZITADEL hosted-login branding (Surface C)
- [x] Mount the handoff `assets/` dir read-only into the `zitadel-seed` service in `docker-compose.yml`
      (`/brand-assets`, `BRAND_ASSETS_DIR` env) — alongside the existing `seed.mjs` mount
- [x] Add `ensureBranding()` to `seed.mjs`, runs before the handoff-file write, in **both** SEED_MODEs:
  - [x] `PUT /admin/v1/policies/label` colors + flags (GET-merge so warn colors aren't blanked):
        primary `#156f41`, `primaryColorDark` `#50986b`, background light `#f0f4f7`/dark `#0e1216`,
        font light `#1b2025`/dark `#eceff2`, `disableWatermark: true`, `themeMode: THEME_MODE_AUTO`,
        `hideLoginNameSuffix: true`
  - [x] Upload assets (hand-built multipart, new `instanceRequest`/`uploadAsset` helpers — no
        `x-zitadel-orgid`): logo light/dark → `/assets/v1/instance/policy/label/logo{,/dark}`,
        icon light/dark → `…/icon{,/dark}`
  - [x] Activate `POST /admin/v1/policies/label/_activate`
  - [x] Idempotent + fail-loud (non-2xx ⇒ `fail()` → `process.exit(1)`; upsert re-applies cleanly)
- [x] OQ-1: instance path chosen — FirstInstance machine user (`fnb-seeder`) holds `IAM_OWNER`;
      org fallback documented inline in `seed.mjs` (403 ⇒ org policy + org-scoped authorize)
- [x] Env rebuilt by the user; ZITADEL login page shows the brand logo + green accent (user-confirmed);
      seed branding exited 0, policy activated

### Phase 4 — Deferred / optional (not in initial build)
- [ ] Custom font: upload JetBrains Mono TTF to the ZITADEL label policy (needs the TTF — OQ-3)
- [ ] Broader in-app header/sidebar logo across apps (beyond the login card) — separate design pass

## Remaining Open Questions

- **OQ-1 (contingency, Phase 3):** Does the FirstInstance seed **PAT** hold `IAM_OWNER` (needed for
  the **instance** label policy via `/admin/v1/policies/label`)? The existing seed only uses the
  **org**-scoped management API (`x-zitadel-orgid`). Our OIDC authorize requests are **not**
  org-scoped, so the hosted login renders the **instance default** branding → instance policy is the
  target. **If the PAT lacks IAM_OWNER:** either grant it the manager role during seeding, or fall
  back to the **org** label policy (`/management/v1/policies/label`) *and* org-scope the authorize
  request (`scope += urn:zitadel:iam:org:id:{orgId}`) so the org branding is what the login shows.
  Verify against the running instance before committing to a path.
- **OQ-2 (Phase 1):** Provide a real brand `favicon.ico`, or delete the stale default `favicon.ico`
  from auth/home/tenant apps and rely on the `<link>` PNG icons? Browsers still auto-request
  `/favicon.ico`; the handoff ships no `.ico`. Cheapest correct option: generate one from
  `favicon-48.png` and drop it in `auth-layer/public/`. Implementor's call at build.
- **OQ-3 (Phase 4):** Is a JetBrains Mono TTF available to upload as the ZITADEL custom font? Not in
  the handoff `assets/`. Deferred — colors + logo already deliver "fits our theme."

## Considered & rejected

- **Colors-only ZITADEL spec** (the pre-handoff plan) — rejected: the handoff supplies real,
  under-cap logo/icon PNGs and exact tokens, so we brand fully, not just recolor.
- **`ZITADEL_DEFAULTINSTANCE_LABELPOLICY_*` env in compose** — rejected as the primary path: applies
  only during fresh-volume FirstInstance (not on idempotent re-runs), and logos there require an
  externally-reachable `LogoURL`. The seed.mjs API path is idempotent and matches how the instance is
  already configured. (May still set colors via env as a belt-and-suspenders default — implementor's option.)
- **Per-app favicon duplication** — rejected: `auth-layer` is the single universal root; one copy
  serves every app.
- **ZITADEL login v2 / Session-API custom UI** — rejected (huge scope): v1 label-policy branding
  meets "fit our theme"; a bespoke login UI is unwarranted and would disturb the working v1 pinning.
