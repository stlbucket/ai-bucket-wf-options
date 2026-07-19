# Plan: Asset detail page — `/storage/assets/[id]` (metadata, children, workflow deep-link, delete)

> **Execution Directive:** Spec is complete — implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor <this plan file>` (self-referential — the path is wherever this
> file currently lives under `.claude/issues/`, so it never goes stale on a move).
> Gate is `pnpm build`. Never run `git` (and never during any sqitch session); never rebuild/restart
> Docker yourself — ask the user, then verify read-only. Codegen:
> `pnpm -F @function-bucket/fnb-graphql-client-api generate` (PostGraphile must be running), then
> `pnpm -F @function-bucket/fnb-graphql-client-api build`. Remember the barrel — a missing
> `src/index.ts` export is a runtime ESM crash.
>
> **Spec round complete (2026-07-07):** the `asset-detail.*` pair exists and the ripple sections in
> `_shared.data.md`, `graphql.data.md`, `endpoint.data.md`, `components.ui.md`, `assets-page.ui.md`,
> and `README.md` carry `(detail draft)` blocks. Decisions locked with the user 2026-07-07:
> **soft-delete + object purge + child cascade**, **own-tenant users + super-admin may delete**,
> **store `wf_id` and deep-link to the workflow instance**.
>
> **Implementor invocation** — drive from this plan (sequence + constraints); read the full spec
> tree for the contract:
>
> ```
> /fnb-stack-implementor Implement this plan (<this file>).
> Read the full asset-storage spec tree first: .claude/specs/asset-storage/_shared.data.md,
> endpoint.data.md, graphql.data.md, asset-detail.ui.md, asset-detail.data.md, components.ui.md,
> assets-page.ui.md, assets-page.data.md — plus .claude/specs/global-rules.md and
> .claude/specs/graphql-api-pattern.md.
> Follow the Suggested sequence (§1–§6) IN STAGES: complete one numbered section, stop, and report
> before starting the next. Do NOT run the whole sequence straight through.
> Honor the Execution Directive: DB changes are in-place edits to existing fnb-storage deploy files
> (no new sqitch changes this phase — dev rebuild wipes + redeploys, memory `sqitch-edit-in-place`),
> pnpm build is the gate, never run git, and never rebuild/restart Docker yourself — stop and ask,
> then verify read-only.
> ```
>
> **Stage boundaries (stop + report after each):** §1 DB *(user rebuild — DB wiped/reseeded,
> `project_rebuild_wipes_db`)* → §2 GraphQL/types/codegen *(codegen + package rebuild)* → §3 Endpoint
> (delete route + `wf_id` capture) *(user `docker compose restart storage-app`,
> `project_layer_changes_need_restart`)* → §4 Presign gate *(user `docker compose restart
> graphql-api-app`)* → §5 Detail page + list link *(user `docker compose restart storage-app`)* →
> §6 spec reconcile. The §1, §3, §4, §5 stops are mandatory — each needs a user-run rebuild/restart
> before the next stage can be verified.

**Severity: MEDIUM (feature)** · Workstream: asset-storage · Identified: 2026-07-07

## Goal

Add the asset **detail page** at `/storage/assets/[id]` (storage-app / storage-layer). The list page
correctly shows **parent assets only**; the detail page adds:

1. **All metadata** — uploader (`resident.display_name`) + tenant (`tenant.name`), context + owning
   entity, visibility, type/size/extension, tags, scan status, active/deleted, timestamps.
2. **Image preview** (parent) + a **gallery of derived child assets** (the 256px webp thumbnails,
   `parent_asset_id = id`) — the one place children surface (every list filters `parentAssetId: null`).
3. **Easy deep-link to the processing workflow** — a new nullable `storage.asset.wf_id` records the
   `asset-scan` **workflow instance**, captured in the upload transaction, so the page links to
   `/graphql-api/workflow/[wf_id]` (cross-app, hard nav).
4. **Delete (confirmed)** — soft-delete (`asset_status='deleted'`) + MinIO object purge + child
   cascade, via a **second REST carve-out** `DELETE /storage/api/assets/[id]` (multipart/object
   writes stay off GraphQL; `storage_api` remains unexposed). Own-tenant users + super-admin, enforced
   by **RLS on a SECURITY INVOKER** gate (no new permission).

Full contract: `asset-detail.ui.md` / `asset-detail.data.md` + the `(detail draft)` sections in the
sibling specs.

## Suggested sequence

### 1. DB (sqitch — `db/fnb-storage/`, in-place edits)

All edits are **in place** to existing deploy files (no new sqitch changes — dev rebuild wipes +
redeploys, `sqitch-edit-in-place`). **Never run `git` during the sqitch session.** Keep each edited
file's `revert/` + `verify/` in sync.

1. `00000000010600_storage.sql` — add the column to `storage.asset`:
   `wf_id uuid null` (NO FK — the `wf` module has its own RLS; loose reference like
   `owning_entity_id`). No index needed (looked up by `id`, not by `wf_id`).
2. `00000000010615_storage_api.sql` — add the delete gate alongside `insert_asset`
   (**SECURITY INVOKER** — RLS scopes which rows the caller may touch; do **not** delegate to a
   SECURITY DEFINER helper, which would bypass RLS and let any `p:app-user` delete cross-tenant):
   ```sql
   create or replace function storage_api.delete_asset(_id uuid)
     returns setof storage.asset
     language plpgsql volatile security invoker as $$
   begin
     perform jwt.enforce_any_permission(array['p:app-admin','p:app-user']::citext[]);
     return query
       update storage.asset
          set asset_status = 'deleted', updated_at = current_timestamp
        where (id = _id or parent_asset_id = _id)   -- asset + derived children
          and asset_status = 'active'
       returning *;
   end; $$;
   ```
   Grant `execute` to `authenticated` (match `insert_asset`'s posture — verify whether
   `00000000010620_storage_policies.sql` has a blanket `grant execute … on schema storage_api to
   authenticated` that already covers it; if so, no extra grant line).
3. Confirm the `verify/` for these two files asserts the column exists and the function is callable;
   `revert/` drops the column / function.

**Stop — the DB change needs a user rebuild** (`project_rebuild_wipes_db`: the rebuild wipes/reseeds;
verify read-only afterward with the super-admin `bucket@` per memory).

### 2. Types / GraphQL / codegen (`packages/fnb-types`, `packages/graphql-client-api`)

4. `packages/fnb-types/src/asset.ts` — `Asset` gains `wfId: string | null` (already in
   `_shared.data.md`). Barrel stays intact.
5. `packages/graphql-client-api/src/graphql/storage/fragment/Asset.graphql` — add `wfId`
   (fragments select **every** exposed field — `feedback_fragments_all_fields`).
6. New op `packages/graphql-client-api/src/graphql/storage/query/assetDetail.graphql` — the
   `AssetDetail($id: UUID!)` query: `asset(id: $id) { ...Asset tenant { name } resident { displayName } }`
   + `children: assetsList(condition: { parentAssetId: $id }, orderBy: CREATED_AT_DESC) { ...Asset }`.
   **Verify inflected names in GraphiQL** at this step: the by-PK accessor (`asset(id:)` vs
   `assetById`) and the uploader relation (`resident { displayName }` vs `storageResident` /
   `residentByResidentId` — the `tenant` relation already surprised us; it was **not** `storageTenant`).
   Fix the `.graphql` doc to whatever codegen resolves.
7. `pnpm -F @function-bucket/fnb-graphql-client-api generate`.
8. Mapper `src/mappers/asset.ts` — `toAsset` gains `wfId: f.wfId ?? null`.
9. New composable `src/composables/useAssetDetail.ts` — wraps `useAssetDetailQuery`; returns
   `{ asset: ComputedRef<AssetDetailView | null>, children: ComputedRef<Asset[]>, fetching, error,
   refresh }`; `asset` folds `tenantName` + `uploaderName` (relation fields the mapper doesn't see);
   `AssetDetailView = Asset & { uploaderName: string | null }` (R4). **Barrel-export** it in
   `src/index.ts`.
10. `pnpm -F @function-bucket/fnb-graphql-client-api build`. storage-layer re-export:
    `packages/storage-layer/app/composables/useAssetDetail.ts` (thin re-export + `Asset` type).

**Stop — codegen + package rebuild** (the `packages-watch` service must pick up the rebuilt client).

### 3. REST: delete endpoint + upload `wf_id` capture (`packages/storage-layer/server/`)

11. `server/api/upload.post.ts` — inside the existing `withClaims` transaction, capture the workflow
    instance id returned by `wf_api.queue_workflow('asset-scan', …)` and
    `update storage.asset set wf_id = $1 where id = $2`. **Verify the SQL return shape** (`json.wf.id`
    path per `workflow/[id].data.md`'s `QueueWorkflow` composable) — it's a `[FILL IN]` in
    `endpoint.data.md`. Null-safe: skip the update if no id resolves.
12. New handler `server/api/assets/[id].delete.ts`:
    - auth (`event.context.claims`; 401 no claims, 403 lacks `p:app-admin`/`p:app-user` or no
      tenant), validate the uuid param (400).
    - `withClaims(claims, fn)` → `select * from storage_api.delete_asset($1::uuid)`; empty result ⇒
      **404**.
    - **after commit**, best-effort `DeleteObject` for each returned row's `(bucket, storage_key)`
      (`Promise.allSettled`; log rejections). Reuse storage-layer's existing S3 client (`server/lib/s3.ts`)
      — it already does `PutObject`; `DeleteObjectCommand` needs no new dep/env.
    - respond `200 { deleted: n }`.
13. `composables/useAssetDelete.ts` (layer-local) — imperative `$fetch` `DELETE` to the
    `assets/[id]` sibling of `public.uploadUrl` (strip `/upload`); `messageForDeleteStatus` toast map.

**Stop — storage-layer edits don't hot-reload** (`project_layer_changes_need_restart`): ask the user
to `docker compose restart storage-app`, then verify read-only.

### 4. Presign gate (`apps/graphql-api-app/server/graphile/asset-download-url.plugin.ts`)

14. Extend the `downloadUrl` plan to also read `$asset.get('asset_status')` and
    `return null` when `asset_status !== 'active'` (soft-deleted → no URL; the object is purged
    anyway). Raw snake_case column name (`downloadurl-presign-gotchas`). `graphql.data.md` §3.

**Stop — ask the user to `docker compose restart graphql-api-app`**, then verify read-only.

### 5. Detail page UI + list link (`packages/storage-layer/app/`)

15. `pages/assets/[id].vue` — build to `asset-detail.ui.md`: `PageHeader` (title = originalName,
    Back / Download / Delete actions), loading/error/not-found states, the two-card grid (metadata
    definition list + preview/scan/workflow-link card), the derived-children thumbnail gallery, and
    the `UModal` delete confirmation. Cross-app workflow link uses `:to` + **`external`** (hard nav).
    Delete → `useAssetDelete().remove(id)` → toast → `navigateTo('/storage/assets')`.
16. `components/AssetList.vue` — wrap the name in a `#originalName-cell` `<ULink :to="`/storage/assets/${row.original.id}`">`;
    add the `linkDetail?: boolean` prop (default `true`).
17. UC rules: color tokens only (UC6), toasts (UC7), UCard container (UC4), responsive grid (UC5),
    **verify every `i-lucide-*` icon exists** (UC11): `arrow-left`, `download`, `trash-2`, `workflow`,
    `external-link`, `file`, `file-question`, `image` (storage-app declares `@iconify-json/lucide`
    directly — `iconify-collection-per-app`).

**Stop — ask the user to `docker compose restart storage-app`**, then verify read-only end-to-end.

### 6. Specs to reconcile (flip `(detail draft)` → implemented)

18. Flip the Status blocks + remove `(detail draft)` / resolve the relevant Open Questions across
    `asset-detail.ui.md`, `asset-detail.data.md`, `_shared.data.md`, `graphql.data.md`,
    `endpoint.data.md`, `components.ui.md`, `assets-page.ui.md`, and the `README.md` index — record
    the verified inflected names (§2.6), the `wf_id` JSON path (§3.11), and the list-`assetStatus`
    decision (below) as resolved.

## Open questions — resolve during implementation

- [ ] **Inflected names** (§2.6): by-PK accessor (`asset(id:)` vs `assetById`) and uploader relation
      (`resident { displayName }` vs alternatives). Verify in GraphiQL post-codegen; correct the op.
- [ ] **`wf_id` JSON return path** (§3.11): the exact shape `wf_api.queue_workflow` returns for the
      instance id. Confirm against `db/fnb-wf/deploy/00000000010520_wf_fn.sql` + the `QueueWorkflow`
      composable's `json.wf.id` extraction.
- [ ] **Soft-deleted rows in the site list**: today `AllAssets` has no `assetStatus` filter (infected
      rows already soft-delete and are visible to operators by design — see
      `asset-entity-composable.plan.md` W3). Decide whether the detail-page delete should make the
      row disappear from `/storage/assets` too. Recommended for consistency with that plan: leave
      `AllAssets` unfiltered (operator visibility) but ensure `downloadUrl` is null (done in §4) so a
      deleted row shows no working download. If the user wants deleted rows hidden, add
      `condition: { assetStatus: ACTIVE, parentAssetId: null }` — coordinate with W3 so the two
      plans don't diverge.
- [ ] **Checksum row** on the detail page: `checksum_sha256` is not currently in the fragment /
      fnb-types. Add it (unhidden column → fragment → `Asset.checksumSha256`) only if we want it
      shown; recommended super-admin-only if included. Otherwise drop the metadata row.
- [ ] **Grant line for `delete_asset`** (§1.2): confirm whether the policies file's blanket
      `storage_api` grant already covers it, else add an explicit `grant execute … to authenticated`.
- [ ] **`public.assetsApiBase` runtimeConfig** vs deriving from `public.uploadUrl` (§3.13) — pick
      one; deriving avoids a second key.

## Verification (read-only, after the user rebuilds/restarts)

1. `pnpm build` green; codegen produced `useAssetDetailQuery` with `wfId` on the fragment.
2. Click a list row → lands on `/storage/assets/[id]`; all metadata renders, uploader + tenant names
   present (super-admin viewing another tenant's asset).
3. Upload a **new** image → its row's `wf_id` is set; the detail page's "View processing workflow"
   deep-links to `/graphql-api/workflow/[wf_id]` and that page shows the matching `asset-scan` run.
4. The detail page's **Derived assets** section shows the thumbnail child with a working preview +
   download; the child never appears in the `/storage/assets` list.
5. **Delete** a private asset (with a thumbnail): confirm modal warns about the child →
   `200 { deleted: 2 }`; both `storage.asset` rows flip to `asset_status='deleted'`; both MinIO
   objects are gone; `downloadUrl` is now null; the page navigates back to the list.
6. Delete idempotency / auth: re-delete → **404**; a `p:app-user` in tenant A attempting to delete a
   tenant-B asset id (hand-rolled `curl`) → 404 (RLS matched 0 rows); super-admin can delete any.
7. A soft-deleted asset mints **no** `downloadUrl` in GraphQL (public and private) — §4 gate.
8. `pnpm build` still green after the spec reconcile (§6 is docs-only).
