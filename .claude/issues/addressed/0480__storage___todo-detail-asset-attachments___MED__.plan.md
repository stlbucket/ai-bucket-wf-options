# Plan: Todo detail — real asset attachments (replace the static placeholder)

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor <this-file>`
> Spec updates go through `fnb-stack-spec` first (memory `feedback_spec_before_build`).
> Gate is `pnpm build`. Never run `git`; never rebuild/restart Docker yourself — ask the user,
> then verify read-only. Codegen: `pnpm -F @function-bucket/fnb-graphql-client-api generate`
> (PostGraphile must be running). Remember the barrel — a missing `src/index.ts` export is a
> runtime ESM crash, not a build error.

**Severity: MED** · Workstream: storage × todo · Identified: 2026-07-09

## Context

`apps/tenant-app/app/components/todo/TodoDetailAttachments.vue` is a **static placeholder**
(hard-coded fake files, dead "Upload" button), rendered by both `TodoDetail.vue` (desktop rail)
and `TodoDetailSmall.vue` (mobile accordion). The todo specs
(`.claude/specs/tenant-app/tools/todo/[id].{ui,data}.md`) do not mention attachments at all —
the implemented page already drifted past its spec.

Everything below the page already exists (asset-storage workstream, Phases 1–9 + v2 + detail):

- `storage.asset` with `context='todo'` + `owning_entity_id`; RLS tenant-scoped.
- GraphQL op `AssetsByOwningEntity($context, $owningEntityId)` + `Asset` fragment + `toAsset`
  mapper (`packages/graphql-client-api`).
- `AssetUploader.vue` / `AssetList.vue` — props-driven, built precisely for this embedding
  (`context="TODO"`, `owningEntityId=<todo id>`), in `packages/storage-layer/app/components/`.
- `useAssetUpload` (storage-layer app composable) → POST `NUXT_PUBLIC_UPLOAD_URL`
  (`/storage/api/upload`, same-origin, session cookie rides along; 202/PENDING flow).
- `AssetContext` already includes `'TODO'` (`packages/fnb-types/src/asset.ts`).

**Prerequisite / sibling issue:** `0330__storage___asset-entity-composable_________LOW__.plan.md`
(currently in `identified/`) delivers `useEntityAssets(context, owningEntityId)` + the W3
`assetStatus: ACTIVE` filter on `AssetsByOwningEntity` + the tenant-app⟶storage-layer `extends`
decision. Its scope guard explicitly defers the page embedding to "whichever module does it
first" — **this plan is that per-feature task.** Execute 0330 first (or as Phase 1 of this work);
do not duplicate its steps here.

## Phases

### 1. Prerequisite — execute 0330
`useEntityAssets` composable (graphql-client-api + barrel + tenant-app thin re-export), the
`assetStatus: ACTIVE` condition, spec codification in asset-storage `_shared.data.md`.

### 2. Spec update (fnb-stack-spec, R18/R20 — before any code) — **DONE 2026-07-09**
Attachments sections added to `tools/todo/[id].ui.md` and `[id].data.md`. All four decisions
resolved by the user (recorded in both files' Decisions sections):

- **List presentation**: option (a) — compact rail rows (the rail is `w-80`; no table)
- **`allowPublic`**: force private (`allowPublic=false`)
- **Delete**: yes in v1, confirm modal, via `useAssetDelete`
- **Detail link**: name links to base-relative `/assets/[id]` AND the download button stays
  in the row
- (spec-author call) `AssetUploader` hosted in a `UModal` opened from the rail header's Upload
  button — the staged flow doesn't fit 320px inline
- `TodoDetailSmall`: same component inside the existing Attachments accordion section.
- The support-tickets `AttachmentsPanel.vue` placeholder stays out of scope (Known Gap).

### 3. Wiring — tenant-app consumes storage-layer
The recorded recommendation (asset-storage `components.ui.md` open question + 0330 §3):

- `apps/tenant-app/nuxt.config.ts` `extends: ['@function-bucket/fnb-storage-layer']` (storage-layer
  already extends tenant-layer — confirm the chain dedupes, msg-layer precedent).
- `apps/tenant-app/package.json` declares the layer (R24; pnpm no-hoist). Keep direct `@nuxt/ui`.
- docker-compose: tenant-app service gets `NUXT_PUBLIC_UPLOAD_URL` (same value storage-app uses)
  so `useAssetUpload` resolves; uploads keep POSTing to `/storage/api/upload` same-origin.
- Side effects to verify and record in the spec: tenant-app inherits storage-layer's
  `server/api/upload.post.ts` (a duplicate live endpoint under `/tenant/api/upload` — harmless
  but note it) and the storage-layer `/assets/[id]` detail page routes.
- Iconify: tenant-app must declare any `@iconify-json/*` the asset components use
  (memory `project_iconify_collection_per_app`).
- New deps ⇒ full `docker compose down && up` cycle (memory `project_pnpm_no_hoist_app_deps`) —
  **ask the user to run it.**

### 4. Implementation
- Rewrite `TodoDetailAttachments.vue` per the spec: props/data via `useEntityAssets('TODO', todoId)`,
  `AssetUploader` with `context="TODO" :owning-entity-id="todoId"`, refresh on `uploaded`,
  toast on error (UC7), `UEmpty`-style zero state (UC8), scan-status badge via
  `statusColor('asset', …)`, download only when `downloadUrl !== null`.
- Keep R2: if option (a) compact rows is chosen, the row list stays props-only; the page (or a
  thin section component) owns the composable call. `AssetUploader` owning its POST is the
  documented R2 exception.
- Wire both `TodoDetail.vue` and `TodoDetailSmall.vue`.

### 5. Verification (read-only; gate `pnpm build`)
- Codegen + `pnpm build` green; barrels verified (`fnb-types`, `graphql-client-api`).
- As a tenant user on a todo detail page: upload a file → 202 toast → row appears `PENDING` →
  after the scan verdict a refresh shows `CLEAN` + download button; EICAR upload never surfaces
  (ACTIVE filter).
- Cross-tenant: another tenant's todo asset never appears (RLS).
- Network tab: list loads via `POST /graphql-api/api/graphql` (`AssetsByOwningEntity`); upload
  via `POST /storage/api/upload`; nothing hits `/tenant/api/*`.

## Scope guard

Todo detail page only. The support-tickets `AttachmentsPanel` placeholder, thumbnails-in-rail,
and drag-and-drop upload are follow-on items — spawn new `identified/` issues if wanted.
