# Workspace Dependency Integrity Pattern

## Status
Implemented (2026-07-09, item `0220__infra_____workspace-dep-integrity`): Remediations A–C landed,
`scripts/dep-audit.ts` + root `dep-audit` script in place and exiting clean. The
`fnb-db-access` purge from `graphql-client-api`/`auth-ui` was deliberately left to item
`0280__infra_____dependency-pinning` (overlap rule: whichever executes first does it).
No `[FILL IN]` markers. Companion rule: **global-rules R24**.

The "Version alignment — pnpm catalog" section is also **Implemented** (2026-07-09, same day,
executed as the remainder of item `0280__infra_____dependency-pinning`): default catalog seeded
in `pnpm-workspace.yaml` (21 entries), all manifests on the `catalog:` protocol, zero
resolved-version movement in the lockfile, `dep-audit` extended with the two hard-fail checks.
The `fnb-db-access` purge (0280 item 2) landed in the same pass — `graphql-client-api` and
`auth-ui` no longer declare it (auth-ui's stale rollup `external` entry removed too).

---

## Motivation

TypeScript errors appear in the IDE — usually in `packages/*-layer/` files — that do not appear
at compile time (`pnpm build` passes). The audit found **two distinct causes**, and both must be
fixed; the dependency rule alone does not remove the IDE errors.

**Cause 1 — undeclared dependencies.** The workspace uses pnpm's default isolated
`node_modules` (no `.npmrc`, no hoisting — `h3`, `vue`, etc. do **not** exist at the root
`node_modules`). A package that imports a bare specifier it does not declare only works because
Nitro/Vite bundling resolves through the dependency graph at build time. Strict TS resolution in
the IDE (and any future tooling) fails.

**Cause 2 — layers are not TypeScript projects.** Every app and every compiled package has a
`tsconfig.json`; **none of the four Nuxt layers do** — no `tsconfig.json`, no `.nuxt`, no
`nuxt prepare` step. An app's tsconfig references its generated `.nuxt/tsconfig.*.json`, which is
what teaches TS about auto-imports, `#imports`, layer-contributed composables, and Nuxt UI
component types. When the IDE opens a file under `packages/msg-layer/app/`, none of that
machinery exists — the TS server falls back to the root `tsconfig.json` (a generic non-Nuxt
config), so `ref`, `useToast`, `UButton` props, `defineEventHandler`, `H3Event`, etc. all show
phantom errors. `nuxt build` passes because each app compiles the layer files inside its own
`.nuxt` context.

The two fixes reinforce each other: once a layer has its own `.nuxt`, the IDE resolves against
the layer's **own** dependency set — an undeclared dep becomes an immediate, visible IDE error
instead of silently borrowing the consuming app's context.

---

## The Rule (global-rules R24)

> Every workspace package declares, in its **own** `package.json`, every external bare specifier
> that its own source and config files resolve — including type-only imports. Nuxt layers
> additionally declare their parent layer (the `extends` target) and are self-preparable
> TypeScript projects (`tsconfig.json` + `nuxt prepare`).

### What counts as "used" (declaration required)

| Usage form | Example | Counts? |
|---|---|---|
| Value or type import in `.ts`/`.vue` | `import type { H3Event } from 'h3'` | yes |
| `extends:` entry in `nuxt.config.ts` | `extends: ['@function-bucket/fnb-tenant-layer']` | yes — workspace dep |
| `modules:` entry in `nuxt.config.ts` | `modules: ['@nuxt/ui', 'nuxt-mapbox']` | yes |
| CSS-consumed packages | `tailwindcss` via `main.css`; `@iconify-json/*` via `i-lucide-*` class names | yes — in the package whose file consumes them |
| `vite.optimizeDeps.include` entries | auth-layer includes `['@nuxtjs/color-mode', '@urql/vue', '@vueuse/core']` | yes — **in every consuming app**, because optimizeDeps resolves from the app context (memory `project_pnpm_no_hoist_app_deps`) |
| Nuxt/Nitro **auto-imports** in `app/` code | `ref`, `useToast`, `useNuxtApp` with no import line | no declaration of `vue`/`#imports` required — resolved by the generated `.nuxt` tsconfig (Cause 2 fix) |

### Layer-specific conventions

1. **Parent layer in `dependencies`** — `extends` uses the package-name form and resolves through
   the workspace link (already true in all four layers).
2. **Layer `server/` code imports `h3` utilities explicitly** — `import { defineEventHandler,
   createError } from 'h3'`, never rely on Nitro auto-imports there. auth-layer, tenant-layer,
   and msg-layer already do this; storage-layer's `server/` relies on auto-imports and should be
   converted for consistency. (Layer `app/` code may keep using auto-imports — Cause 2's per-layer
   `.nuxt` makes the IDE resolve them.)
3. **Self-preparable** — every layer has a `tsconfig.json` + a prepare script (see Cause 2 below).
4. **`@nuxt/ui` stays a direct dependency of every layer and app** that renders U-components —
   the existing rule from `fnb-stack-implementor` is a special case of R24.

### Version alignment

One version per external package, repo-wide, declared once in the pnpm **catalog** — see the
dedicated section below. `h3` is additionally force-pinned via root `package.json` →
`pnpm.overrides` to `1.15.11` (that pins **transitive** copies too — e.g. nitropack's — which a
catalog cannot do). Because the override rewrites every `h3` specifier before resolution, the
lockfile's `catalogs:` block does not list `h3` — the manifest entries still read `"catalog:"`
and the two pins are bumped together.

---

## Remediation A — missing declarations (Cause 1)

Audit findings (2026-07-09, scanner: explicit imports in `.ts`/`.vue`/`.mjs`, `node_modules` /
`dist` / `.nuxt` / `src/generated` excluded):

| Package | Add to `dependencies` | Evidence |
|---|---|---|
| `packages/auth-layer` | `"h3": "^1.15.11"` | `server/utils/{session,applyEventClaims,getEventClaims,auth-cookies}.ts` |
| `packages/tenant-layer` | `"h3": "^1.15.11"` | `server/middleware/auth.ts` |
| `apps/graphql-api-app` | `"h3": "^1.15.11"` | `server/api/graphql.ts`, `server/api/graphql/stream.ts`, `server/graphile.config.ts` |
| `apps/graphql-api-app` | `"vue"` (match other apps' resolution — nuxt supplies it; declare `"vue": "^3.5.0"` or the workspace-consistent range) | `app/composables/useWfFlowGraph.ts`, `app/components/WfUowNode.vue`, `app/pages/workflow/[id].vue` |
| `apps/graphql-api-app` | `"@function-bucket/fnb-types": "workspace:*"` | `WfQueueModal.vue`, `useWfInstances.ts`, `useWfFlowGraph.ts`, `workflow/index.vue` |
| `apps/tenant-app` | `"vue"` (same range as above) | `import { h } from 'vue'` in `LicenseList.vue`, `MsgTopicList.vue`, `TicketList.vue` |

Note on `vue`: no app currently declares it (Nuxt provides it transitively and the generated
`.nuxt` tsconfig resolves its types, which is why builds and most IDE views pass). Declaring it
where it is explicitly imported follows R24; pick one range and use it in both apps. Pinning
drift risk is low — pnpm dedupes to Nuxt's copy as long as the range is compatible.

**Docker gate:** new dependencies require the full `docker compose down && docker compose up`
cycle (named `node_modules` volumes — memory `project_pnpm_no_hoist_app_deps`). Never run it
yourself — ask the user (memory `feedback_rebuild_ask_user`).

---

## Remediation B — per-layer TypeScript projects (Cause 2)

This is the change that actually removes the IDE-only errors. Apply to all four layers
(`auth-layer`, `tenant-layer`, `msg-layer`, `storage-layer`):

1. **`package.json` scripts** — add, matching the apps' convention:
   ```json
   "scripts": {
     "dev:prepare": "nuxt prepare",
     "postinstall": "nuxt prepare"
   }
   ```
   `nuxt` is already a direct dependency of all four layers. `postinstall` keeps the generated
   `.nuxt` fresh on every `pnpm install`; `dev:prepare` is the manual re-run after a
   `nuxt.config.ts` change.

2. **`tsconfig.json`** — same shape as the apps':
   ```json
   {
     "files": [],
     "references": [
       { "path": "./.nuxt/tsconfig.app.json" },
       { "path": "./.nuxt/tsconfig.server.json" },
       { "path": "./.nuxt/tsconfig.shared.json" },
       { "path": "./.nuxt/tsconfig.node.json" }
     ]
   }
   ```

3. **`.gitignore`** — root already ignores `.nuxt` globally (line 5); no change needed.

4. **Docker** — the layer `.nuxt` dirs are IDE-only artifacts; containers do not need them
   (apps prepare their own). No compose changes.

Ordering: Remediation A must land first (or together) — `nuxt prepare` in a layer resolves the
layer's `extends` chain and modules from the layer's **own** manifest, so an incomplete manifest
fails or produces a wrong `.nuxt`.

Caveat that stays true: layer file edits still do not hot-reload in Docker (package-name
`extends` → unwatched; memory `project_layer_changes_need_restart`) — this pattern fixes the
IDE, not the watch behavior.

---

## Remediation C — dead dependency purge

Declared-but-unused entries found by the same audit. Purging is hygiene, not correctness — do it
in the same pass, gated by `pnpm build` and a Docker down/up.

### Confirmed dead (no import, no `modules:`/`extends:`/CSS/optimizeDeps reference)

| Package | Remove |
|---|---|
| `apps/auth-app` | `kysely` (retired stack), `postgraphile`, `graphile`, `grafserv`, `graphql-ws`, `@graphile/simplify-inflection`, `pg`, `@types/pg` |
| `apps/tenant-app` | `postgraphile`, `@graphile/simplify-inflection`, `pg`, `@types/pg` |
| `apps/msg-app` | `pg`, `@types/pg`, `@function-bucket/fnb-db-access` |
| `apps/storage-app` | `pg`, `@types/pg`, `@function-bucket/fnb-db-access` |
| `packages/auth-ui` | `@function-bucket/fnb-db-access` (the `ProfileClaims` type moved to `fnb-types`) |
| `packages/graphql-client-api` | `@function-bucket/fnb-db-access` |
| `packages/storage-layer` | `consola`, `pg`, `@types/pg` |

### Verify before purging (plausibly dead, but resolution is indirect)

All verified at implementation time (2026-07-09); outcomes recorded per Known Gaps:

| Package | Candidate | Outcome |
|---|---|---|
| `apps/auth-app`, `apps/graphql-api-app` | `tailwindcss` | **purged** — no app-level CSS/config reference; auth-layer's `main.css` resolves the layer's own copy |
| all apps | `@urql/core` | **purged** (6 apps incl. home-app) — exchanges come from `@urql/vue`, zero direct imports |
| `apps/worker-app` | `pg`, `@types/pg` | **purged** — no direct import; `graphile-worker` brings its own `pg`, worker uses `useFnbPgClient` |
| `packages/storage-layer` | `nitropack`, `h3` | `nitropack` **purged** (copy-paste from msg-layer); `h3` **live/kept** — convention 2 applied (explicit h3 imports in `server/`) |
| `packages/graphql-client-api` | `tsx` | **purged** — codegen runs via `graphql-codegen`; root scripts use the root's tsx |

New finding at implementation: `apps/graphql-api-app` declares `pg` with no direct import
(`postgraphile/adaptors/pg` is a postgraphile subpath, and postgraphile ships its own `pg`
dependency) — left declared, out of 0220 scope; surfaces in the `dep-audit` informational report
for the recurring dead-code sweep.

### Never flag / never purge

- `@vueuse/core`, `@urql/vue` in every app — required by auth-layer's
  `vite.optimizeDeps.include` (resolves from the app context).
- `@nuxt/ui`, `@nuxt/fonts`, `@iconify-json/*`, `tailwindcss` **in layers** — consumed via
  `modules:` / CSS, invisible to import scanners.
- Parent-layer workspace deps — consumed via `extends:` strings.
- `typescript`, `eslint`, `vue-tsc`, `vite`, `vitest`, `vite-plugin-dts`,
  `@graphql-codegen/*` — tooling referenced by scripts/config, not imports.
- `mapbox-gl` in tenant-app — peer of the `nuxt-mapbox` module (and `nuxt-mapbox` itself — a
  `modules:` entry).
- `@types/*` — resolved implicitly by tsc, never imported.
- `vue` in layers — declared as a peer contract; consumed via SFCs/auto-imports.

### Doc drift to fix in the same change (R21)

`package-layers-pattern.md` currently documents two of the dead deps as real:
- auth-ui section: "**Depends on:** `@function-bucket/fnb-graphql-client-api` …,
  `@function-bucket/fnb-db-access` (the `ProfileClaims` type)" — drop the db-access clause
  (`ProfileClaims` comes from `fnb-types`).
- graphql-client-api section: "**Depends on:** … `@function-bucket/fnb-db-access`" — drop it.
- Nuxt Layers section: add the self-preparable convention (tsconfig + prepare scripts) to the
  layer inventories once implemented.

---

## Version alignment — pnpm catalog

**Status: Implemented (2026-07-09).** Superseded item 1 of the 0280 dependency-pinning plan;
its item 2 (the `fnb-db-access` purge) landed in the same implementation pass. Audit date for
the drift inventory: 2026-07-09. Catalog seed values live in `pnpm-workspace.yaml`; single-
consumer loose majors were tightened in place (`postgraphile ^5`→`^5.0.0`,
`@graphile/simplify-inflection ^8`→`^8.0.0`; `grafast`/`graphile-utils` already matched).
Notable drift captured at pin time: `@vueuse/core "latest"` had floated to **14.3.0**, `dotenv`
to 16.6.1, `@aws-sdk/*` to 3.1080.0 — the catalog pins carets at those resolved versions, so
the migration installed nothing new (lockfile packages-set diff: only orphaned transitive
`brace-expansion@5.0.5` dropped, via the db-access unlink).

### Policy

Any external npm package used anywhere in the workspace resolves to **one version repo-wide**.
The mechanism is the pnpm **default catalog** (`catalog:` block in `pnpm-workspace.yaml`,
supported since pnpm 9.5; the repo pins `pnpm@10.17.0`): the version range is declared once in
the catalog, and every manifest references it with the `catalog:` protocol:

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
catalog:
  '@vueuse/core': ^13.6.0   # example — seed real values from pnpm-lock.yaml
  nuxt: ^4.4.2
  '@nuxt/ui': ^4.6.1
  h3: ^1.15.11
```

```json
// any package.json
"dependencies": { "@vueuse/core": "catalog:", "nuxt": "catalog:" }
```

No named catalogs (`catalogs:` plural) — the whole point is uniformity, and named catalogs exist
to permit divergence. If a genuine need for two versions of one package ever appears, that is a
spec change, not a quiet named-catalog addition.

### Scope rules

| Field | Rule |
|---|---|
| `dependencies` / `devDependencies` | Any package declared in **more than one** manifest MUST use `catalog:`. Single-manifest deps MAY stay as direct caret ranges but SHOULD move when touched. |
| `peerDependencies` | **Never catalogued.** Wide peer ranges (`vue: >=3.4.0` in layers, `nuxt: >=4.0.0` in auth-ui, `@urql/vue: >=2.0.0` / `vue: >=3.0.0` in graphql-client-api) are deliberate compatibility contracts, not install instructions — leave them wide. |
| `workspace:*` deps | Untouched — the workspace protocol already guarantees the local copy. |
| `pnpm.overrides` | Reserved for forcing **transitive** resolution only (the `h3` case — nitropack ships its own copy). An overridden package also gets a catalog entry at the same version for direct declarations; the two MUST be bumped together. Never use overrides as the primary alignment mechanism — they rewrite resolution silently while manifests drift on paper. |
| Floating specifiers (`latest`, `*`) | Banned outside `peerDependencies`, catalogued or not. |

Catalog entries use caret ranges pinned at the version currently resolved in `pnpm-lock.yaml`
(the migration must not change what is installed — the lockfile is the seed, and an unchanged
lockfile after `pnpm install` is the proof).

### Drift inventory (2026-07-09)

What the catalog migration actually fixes, per the manifest audit:

| Package | Drift |
|---|---|
| `@vueuse/core` | `"latest"` in **8 manifests** — all 6 Nuxt apps + auth-layer + auth-ui (0280 understated this as 2) |
| `vue` | `"*"` in auth-ui `dependencies`; `^3.5.0` in graphql-api-app/tenant-app (peer `>=` ranges stay as-is) |
| `typescript` | `"*"` in all 5 compiled packages vs `^6.0.2` at root and in apps |
| `vitest` | `"*"` in all 5 compiled packages vs `^4.1.4` at root |
| `pg` / `@types/pg` | `^8` in graphql-api-app vs `^8.20.0` in auth-server/db-access/msg-layer |
| loose majors | `postgraphile: ^5`, `@graphile/simplify-inflection: ^8`, `grafast: ^1.0.0`, `graphile-utils: ^5.0.0` — single-consumer but pin style; tighten to lockfile-resolved ranges while migrating |

Aligned-but-repeated ranges that simply move to the catalog: `nuxt ^4.4.2`, `@nuxt/ui ^4.6.1`,
`@nuxt/eslint ^1.15.2`, `eslint ^10.2.0`, `vue-tsc ^3.2.6`, `@urql/vue ^2.1.1`,
`@iconify-json/* `, `h3 ^1.15.11`, `vite ^8.0.8`, `vite-plugin-dts ^4.5.4`,
`@aws-sdk/client-s3 ^3.700.0`, `graphile-worker ^0.16.6`, `dotenv ^16.4.5`, `tsx ^4.19.4`.

### Migration steps

1. Build the catalog in `pnpm-workspace.yaml` from the lockfile-resolved versions of every
   multi-manifest external package plus every floating specifier above.
2. Rewrite the matching `dependencies`/`devDependencies` entries across all manifests to
   `"catalog:"`. Do not touch `peerDependencies` or `workspace:*`.
3. `pnpm install` at root. Expected outcome: lockfile importers re-keyed to catalog references,
   **no resolved-version changes** except where a floating spec (`latest`/`*`) had already drifted
   ahead of teammates' installs — inspect the diff and call out any real version movement.
4. `pnpm build` green; `pnpm dep-audit` clean (with the extension below).
5. **Ask the user** for the Docker `down && up` cycle (lockfile/`node_modules` named-volume rule —
   memory `project_pnpm_no_hoist_app_deps`), then verify read-only.
6. R21 companions in the same change: add the catalog sentence to **global-rules R24**; note the
   `catalog:` convention in `package-layers-pattern.md`'s dependency sections; update
   `fnb-stack-implementor` (new-dependency workflow: add to catalog first, then `"catalog:"` in
   the manifest) and this skill's pointer.

### Enforcement extension (`dep-audit`)

Two hard-fail checks in `scripts/dep-audit.ts` (implemented; they cover the **root manifest**
too, which the per-package import scanner skips):

- A package name present in the catalog declared with a non-`catalog:` specifier in any
  `dependencies`/`devDependencies` (drift reintroduction).
- Any `latest` or bare `*` specifier outside `peerDependencies`.

---

## Enforcement — `scripts/dep-audit.ts`

ESLint's `import/no-extraneous-dependencies` would be the natural gate, but repo-wide lint is
known-broken (memory `project_eslint_broken`), so enforcement is a standalone script matching
the existing `scripts/*.ts` (tsx) convention:

- **`scripts/dep-audit.ts`** — walks `apps/*` + `packages/*`; extracts bare specifiers from
  `.ts`/`.mts`/`.js`/`.mjs`/`.vue` (skipping `node_modules`, `dist`, `.nuxt`, `.output`,
  `src/generated`); normalizes to package names; diffs against
  `dependencies + devDependencies + peerDependencies`.
- **Exit non-zero on missing declarations** (Cause 1 violations). Unused-declaration output is
  informational only — too many legitimate config-referenced deps (see "Never flag" above) for
  it to gate.
- Built-in allowlist for the "Never flag" classes: node builtins, `#`-alias / `~` / relative
  specifiers, and per-package config-referenced deps.
- Root script: `"dep-audit": "tsx scripts/dep-audit.ts"`. Run it manually before adding deps,
  and as part of the recurring dead-code sweep (`.claude/issues/recurring/`).
- A working prototype was validated during the 2026-07-09 audit (same walk/regex/diff approach,
  it produced the findings above); the implementation should port it into `scripts/` with the
  allowlist added.

`pnpm build` remains the repo gate; `dep-audit` is an additional targeted check, not a build
dependency (avoid coupling turbo tasks to it until it has soaked).

---

## Implementation order

1. **A — missing declarations** (6 edits across 4 manifests) + `pnpm install`.
2. **B — layer tsconfigs + prepare scripts** (8 new/edited files) + run `pnpm -F <layer>
   dev:prepare` per layer; confirm IDE errors disappear in layer files.
3. **C — purge confirmed-dead deps**, then the verify list one at a time; `pnpm build` after
   each manifest change.
4. **Enforcement** — add `scripts/dep-audit.ts` + root script; run it clean.
5. **Docs (R21)** — `package-layers-pattern.md` fixes above; R24 already added to
   `global-rules.md`; both skills already point here.
6. **Ask the user** to run `docker compose down && docker compose up` (new deps → named volume
   cycle), then verify read-only.

Steps 1–3 all touch `package.json` files only (plus storage-layer's explicit h3 imports);
nothing here changes runtime behavior — `pnpm build` passing before and after is the
correctness check.

---

## Known Gaps

- The verify-before-purge list (Remediation C) needs per-item confirmation at implementation
  time; items that prove live get moved to the "never purge" list here.
- `dep-audit.ts` cannot see config-string usage (`modules:`, `extends:`, CSS) — its unused
  report will always need the allowlist; missing-dep detection is the only hard gate.
- Whether `dev:prepare` should become a turbo task (so `pnpm install` at root prepares all
  layers in dependency order) — decide after the per-layer `postinstall` approach soaks.
- Single-manifest deps not yet catalogued (`openid-client`, `mapbox-gl`, `@graphql-codegen/*`,
  etc.) move to the catalog opportunistically when touched (Scope rules: MAY stay / SHOULD move).
