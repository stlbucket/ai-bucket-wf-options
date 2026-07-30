# Plan: URN Stacking v2 — retire the pre-registry reference mechanisms

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/urn-registry/stacking-v2.data.md` (locked
> decisions + verbatim SQL live there — do not re-derive, R21). In-place edit strategy per
> v1 (`_shared.data.md` §4): no new sqitch changes, no backfills; DB state lands only on
> full rebuild. Never run `git` in a sqitch session; never rebuild/restart the env —
> ask the user (memory `rebuild-ask-user`), then verify read-only.

**Severity: MED** (platform follow-up to 0010 urn-registry) · Workstream: db/platform ·
Planned: 2026-07-10 from the post-v1 URN audit; user directive same day: "do the
recommended conversions" (recommended defaults locked: one discussion per subject,
`msg.topic.context` retired, `storage.asset.wf_id` untouched).

## Context

The v1 registry left two pre-registry polymorphic mechanisms alive and one dead column:

1. `storage.asset.context` (enum) + `owning_entity_id` (loose uuid) coexist with
   `subject_urn` — and the UI still writes/reads the old pair.
2. Todo discussions **share ids**: `msg.topic.id = todo.id` (`useTodoMsg.ts:29` +
   `msg_fn.upsert_topic` honoring caller ids). `register_resource` no-ops on conflict, so
   such topics have no registry row and a **dangling generated URN**.
3. `app.support_ticket.topic_id` — never written, unreferenced.

## Verified anchors (2026-07-10; line numbers may drift — re-locate by statement)

- Storage DDL `db/fnb-storage/deploy/00000000010600_storage.sql:3` (enum), `:13-14`
  (columns), `:41` (idx). Composite `…10608:6-7`. Inserts `…10610:46-47,65-66` and
  `…10625:85-86,105-106`. Public fn `…10615:42` + `…10635:16`; grant `…10620:24`.
- Upload endpoint `packages/storage-layer/server/api/upload.post.ts:79-80,99-101,128-131,
  152-174,205-206`; validation lib `packages/storage-layer/server/lib/asset-validation.ts`.
  Worker promote is a `^quarantine/` prefix swap only
  (`apps/worker-app/server/lib/worker-task-handlers/resolve-asset.ts:33`) — key-shape change
  is safe.
- Msg DDL `db/fnb-msg/deploy/00000000010400_msg.sql:23` (context col). Composite
  `…10408:19` . `upsert_topic` `…10410:37-70`. `db/seed.sql` does not touch msg; no
  positional `topic_info` casts exist.
- App `db/fnb-app/deploy/00000000010220_app.sql:321`.
- Client: `AssetContext` consumers = `useEntityAssets.ts`, `mappers/asset.ts`,
  `AssetList.vue`, `AssetUploader.vue`, `useAssetUpload.ts`, `upload.post.ts`,
  `asset-validation.ts`, `fnb-types/src/{asset,index}.ts`. `createTopic` callers never pass
  `domain` (`tenant-app msg/index.vue`, `msg-layer messages/index.vue`).
  `useSiteAssets` selects `owningEntityId`. Todo page `tools/todo/[id].vue:24`.

## Phases

### Phase 1 — DB in-place edits (spec §1.1–1.4, §2.1–2.3, §3)
- fnb-storage: 10600 (enum/columns/index), 10608 (13-field composite), 10610, 10625,
  10615+10635 (`public_assets_for_subject(_subject_urn text)`), 10620 (grant).
- fnb-msg: 10400 (`subject_urn` + `uq_topic_subject_urn` partial unique; drop `context`),
  10408 (composite: drop context, trailing `subject_urn`), 10410 (match clause + RLS
  visibility guard + insert — verbatim SQL in spec §2.3).
- fnb-app: 10220 drop `topic_id`.
- True up verify (+ meaningful revert) for every edited change — skill
  `true-up-sqitch-package`.

### Phase 2 — server TS (lands with Phase 1, pre-rebuild)
- `upload.post.ts`: drop context/owningEntityId fields + validation; 13-param positional
  cast; key `quarantine/{tenantId}/{subjectSeg}/{assetId}.{ext}`,
  `subjectSeg = parseUrn(subjectUrn).id ?? assetId`; `AssetRow`/`AssetMeta` reshape.
- `asset-validation.ts`: delete `ASSET_CONTEXTS`/`toDbContext`/`toAssetContext`.
- `useAssetUpload.ts` + `AssetUploader.vue`: `subjectUrn` replaces context/owningEntityId.

### ⏸ USER REBUILD GATE
In-place edits are invisible to `sqitch deploy`. Ask the user to rebuild, then verify
read-only (spec §5).

### Phase 3 — codegen + client (spec §1.6, §2.4)
- Codegen (`pnpm -F @function-bucket/fnb-graphql-client-api generate`) against the live
  schema; record inflected names (`publicAssetsForSubjectList`, topic `subjectUrn`
  condition).
- fnb-types: retire `AssetContext`; `Asset`/`AssetMeta`/`Topic` reshapes; barrel.
- Docs: `Asset.graphql`/`Topic.graphql` fragments; `assetsBySubject.graphql`,
  `publicAssetsForSubject.graphql`, `discussionBySubject.graphql`; `upsertTopic` input.
- Composables: `useEntityAssets` → `useSubjectAssets`; `useTodoMsg(todoUrn)` by subject
  (no id, no context); `useMsgTopics.createTopic` drops `domain`; mappers; **barrels**.
- Apps: `tools/todo/[id].vue` (`useSubjectAssets(todo.urn)`, TodoMsg gets the urn);
  tenant-app re-export rename; `useSiteAssets` column sweep.
- `pnpm build` green (the gate; repo lint is broken).

### Phase 4 — docs + verification + hand-off
- R21 sync: asset-storage spec, tenant-app msg/todo specs (Mode 3 notes), stacking-v2
  Status flip, README task-list checkboxes.
- Verification per spec §5 (read-only).
- **Ask the user** before moving this plan to `addressed/`.

## Out of scope
`storage.asset.wf_id` (stays loose), `msg.topic.identifier` (stays), wf missing FKs
(`uow.tenant_id`, `uow_dependency.tenant_id`, `uow.parent_uow_id`, `wf.uow_id` — file
separately), `wf.wf.subject_urn`, attachment-panel UI, re-parenting API.
