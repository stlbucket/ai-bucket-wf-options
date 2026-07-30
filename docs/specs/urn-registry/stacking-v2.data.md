# URN Registry — Stacking v2: retire the pre-registry reference mechanisms

## Status
Implemented — 2026-07-10, same session as the audit (plan
`0490__db________urn-stacking-v2_________________MED__.plan.md`). Verified against the rebuilt
stack: DB shape checks (§5), rolled-back write-path e2e (todo + discussion by subject URN:
topic gets its own id + `msg/topic` registry row, urn resolves, upsert-by-subject idempotent,
deferred FK holds under `set constraints all immediate`), `pnpm build` green (12/12).
Implementation deltas from the draft: `AssetList`/asset-detail show a **Subject** badge
(`parseUrn` module/type) where the context column was; `useSubjectAssets`/`useTodoMsg` **pause**
their queries until the subject urn resolves; `TodoMsg` renders `Msg` with the topic's real id
(`topic.id`, not the todo id); the `SupportTicket` fragment/type/mapper dropped `topicId`.

Origin: the 2026-07-10 post-v1 URN audit. Three conversions, all in-place edits per the v1
retrofit strategy (`_shared.data.md` §4 — no new sqitch changes, no backfills; DB state is
reached only by full rebuild).

## Decisions locked this round (2026-07-10, user: "do the recommended conversions")

| Decision | Choice | Why |
|---|---|---|
| `storage.asset.context` + `owning_entity_id` | **Dropped**; `subject_urn` is the only attach mechanism | The v1 "coexistence" is over: the enum is a hand-rolled type registry the URN grammar subsumes; the uuid had no integrity; the UI still wrote the old pair, splitting the data. |
| Todo↔discussion linkage | `msg.topic.subject_urn text NULL REFERENCES res.resource(urn)`; topics get their own ids | The id-sharing hack (`topic.id = todo.id`) left topics with **no registry row of their own** (`register_resource` no-ops on conflict) and a dangling generated URN — `resolveUrn` misses, nothing can stack onto a topic. |
| Discussions per subject | **One** — partial unique index on `subject_urn` | Matches the current UX (`hasTopic` boolean, single discussion panel) and gives `upsert_topic` idempotency-by-subject. Relaxable later by dropping the index. |
| `msg.topic.context` | **Retired** (column + `topic_info` field + fragment + `createTopic` domain param) | Audit: only ever written, never filtered or displayed. Standalone discussion ⇔ `subject_urn IS NULL`; the subject's module/type is derivable via `parseUrn`. |
| `app.support_ticket.topic_id` | **Dropped** | Dead column — never written anywhere, no FK possible (fnb-app deploys before fnb-msg). Future ticket discussions use `msg.topic.subject_urn` pointing at the ticket's URN. |
| `storage.asset.wf_id` | Unchanged (loose uuid) | Internal scan plumbing, one writer; conversion churn buys nothing now. |
| `msg.topic.identifier` | Unchanged | General-purpose idempotency key, orthogonal to URNs; not part of this scope. |
| wf missing FKs (`uow.tenant_id`, `uow_dependency.tenant_id`, `uow.parent_uow_id`, `wf.uow_id`) | **Out of scope** — integrity gap, not URN work | Audit aside; file separately if wanted. |

---

## §1 Storage — complete the `subject_urn` migration

### 1.1 DDL (in-place, `db/fnb-storage/deploy/00000000010600_storage.sql`)

- Delete the enum `storage.asset_context` and the columns
  `context storage.asset_context not null default 'no_context'` and
  `owning_entity_id uuid` from `storage.asset`.
- Delete `create index idx_asset_owning_entity … (context, owning_entity_id)`.
- Everything else (incl. `subject_urn` + `idx_asset_subject_urn`) already shipped in v1.

### 1.2 `asset_info` composite (`…10608_storage_fn_types.sql`)

Remove `context` and `owning_entity_id`. The composite shrinks from 15 to 13 fields —
**every positional `row(...)` cast renumbers** (the upload endpoint is the only one).
`subject_urn` stays TRAILING.

```sql
create type storage_fn.asset_info as (
  id               uuid
 ,is_public        boolean
 ,original_name    text
 ,extension        text
 ,content_type     text
 ,size_bytes       bigint
 ,bucket           text
 ,storage_key      text
 ,checksum_sha256  text
 ,scan_status      storage.scan_status
 ,scan_signature   text
 ,tags             citext[]
 ,subject_urn      text       -- TRAILING position — keeps the endpoint's positional row(...) cast a one-param addition
);
```

### 1.3 `_fn` bodies

- `…10610_storage_fn.sql` `insert_asset`: remove `context`/`owning_entity_id` from the
  insert column list + select list (and the "loose association" comment). The subject
  visibility guard is unchanged.
- `…10625_storage_resolve_asset_scan.sql` `insert_derived_asset`: remove the two inherited
  fields from the insert (`_parent.context`, `_parent.owning_entity_id`).

### 1.4 Public read fn (`…10615_storage_api.sql` original + `…10635_storage_public_reads_clean.sql` rework + `…10620_storage_policies.sql` grant)

`public_assets_for_entity(_context storage.asset_context, _owning_entity_id uuid)` becomes:

```sql
-- public assets attached to a subject (the "query related files" access, public variant)
create or replace function storage.public_assets_for_subject(_subject_urn text)
  returns setof storage.asset
  language sql stable security definer set search_path = '' as $$
    select a.* from storage.asset a
    where a.subject_urn = _subject_urn
      and a.is_public and a.asset_status = 'active'
      and a.scan_status = 'clean'          -- 10635 variant only (quarantine-first gate)
    order by a.created_at desc;
  $$;
```

Grant line (10620): `grant execute on function storage.public_assets_for_subject(text) to anon, authenticated;`

Anon callers get the subject's URN off the public row they already fetched (`loc.location.urn`
is a plain column on the anon-visible row) — no registry SELECT needed: the filter is on
`storage.asset.subject_urn` text.

### 1.5 Upload endpoint (`packages/storage-layer/server/api/upload.post.ts`)

- Remove the `context` / `owningEntityId` form fields, their validation
  (`ASSET_CONTEXTS`, `isUuid` requirement), and `toDbContext`/`toAssetContext` usage.
- Positional cast shrinks: `row($1::uuid, $2::boolean, $3::text, …, $13::text)::storage_fn.asset_info`.
- Storage key: `quarantine/${tenantId}/${subjectSeg}/${assetId}.${extension}` where
  `subjectSeg = subjectUrn ? parseUrn(subjectUrn).id : assetId`. Safe: the worker's promote
  step is a pure `^quarantine/` prefix swap (`resolve-asset.ts:33` — no segment parsing).
- `AssetRow` interface + the `AssetMeta` response lose `context`/`owningEntityId`, gain
  `subjectUrn`.
- `packages/storage-layer/server/lib/asset-validation.ts`: delete `ASSET_CONTEXTS`,
  `toDbContext`, `toAssetContext` (keep `isUuid` only if still referenced).

### 1.6 Client (post-rebuild, codegen-dependent)

- `packages/fnb-types/src/asset.ts`: retire `AssetContext`; `Asset`/`AssetMeta` drop
  `context`/`owningEntityId` (keep `subjectUrn`); barrel `src/index.ts` sync.
- `storage/fragment/Asset.graphql`: drop `context`, `owningEntityId`.
- `storage/query/assetsByOwningEntity.graphql` → `assetsBySubject.graphql`:
  `assetsList(condition: { subjectUrn: $subjectUrn, parentAssetId: null, assetStatus: ACTIVE }, orderBy: CREATED_AT_DESC)`.
- `storage/query/publicAssetsForEntity.graphql` → `publicAssetsForSubject.graphql`
  (`publicAssetsForSubjectList(_subjectUrn: $subjectUrn)` — verify inflected name in GraphiQL).
- `composables/useEntityAssets.ts` → `useSubjectAssets(subjectUrn: MaybeRef<string>)`; same
  return shape (`assets`, `fetching`, `error`, `refresh`). Barrel line updated; the tenant-app
  re-export `apps/tenant-app/app/composables/useEntityAssets.ts` renames too.
- `apps/tenant-app/app/pages/tools/todo/[id].vue:24`: `useSubjectAssets(todo.urn)` (todo
  entity carries `urn` since v1). Upload-side (`useAssetUpload`, `AssetUploader.vue`):
  `context`/`owningEntityId` args replaced by the already-supported `subjectUrn`.
- `mappers/asset.ts`, `useSiteAssets` (site-admin listing selects `owningEntityId`) — sweep
  every `AssetContext` consumer: `AssetList.vue`, `AssetUploader.vue`, `useAssetUpload.ts`.

## §2 Msg — `topic.subject_urn`, retire `context`, end id-sharing

### 2.1 DDL (in-place, `db/fnb-msg/deploy/00000000010400_msg.sql`)

In `create table msg.topic`: delete `context citext not null default 'discussion'`, add

```sql
  subject_urn text null references res.resource(urn),
```

after `tenant_id`, and after the table:

```sql
create unique index uq_topic_subject_urn on msg.topic (subject_urn)
  where subject_urn is not null;   -- one discussion per subject (relaxable)
```

### 2.2 `topic_info` composite (`…10408_msg_fn_types.sql`)

Remove `context`; append TRAILING `subject_urn text` (no positional casters exist — the only
caller is PostGraphile's named-field input type; `db/seed.sql` does not touch msg).

### 2.3 `upsert_topic` (`…10410_msg_fn.sql`)

- Match clause gains subject idempotency:

```sql
    where (id = _topic_id
           or (_topic_info.identifier is not null and identifier = _topic_info.identifier)
           or (_topic_info.subject_urn is not null and subject_urn = _topic_info.subject_urn))
    and tenant_id = _resident.tenant_id
```

- Subject visibility guard (before insert; `msg_fn.upsert_topic` is SECURITY INVOKER, so a
  plain RLS-filtered registry select is the guard — unlike storage's DEFINER mirror):

```sql
    if _topic_info.subject_urn is not null then
      perform 1 from res.resource where urn = _topic_info.subject_urn;
      if not found then
        raise exception '30000: NOT AUTHORIZED';
      end if;
    end if;
```

- Insert: drop `context`, add `subject_urn` (`_topic_info.subject_urn`). Registration call
  unchanged — topics now always have their own id (callers stop supplying a foreign id), so
  `register_resource` inserts a real `('msg','topic')` row and the generated URN resolves.

### 2.4 Client (post-rebuild)

- `discussions/fragment/Topic.graphql`: drop `context`, add `subjectUrn`.
- New `discussions/query/discussionBySubject.graphql`: `topicsList(condition: { subjectUrn: $subjectUrn }, first: 1)`
  with the `DiscussionById` selection (subscribers + messages). `discussionById` stays for the
  msg inbox route.
- `useTodoMsg(todoUrn)`: query by subject; `startDiscussion` sends
  `topicInfo: { name, subjectUrn, subscribers, initialMessage }` — **no `id`, no `context`**.
- `useMsgTopics.createTopic`: drop the `domain` param + `context` field (callers
  `apps/tenant-app/app/pages/msg/index.vue`, `packages/msg-layer/app/pages/messages/index.vue`
  never passed it).
- `apps/tenant-app/app/components/todo/TodoMsg.vue`: takes the todo's `urn` (prop or
  `formatUrn`) instead of `todoId`.
- `packages/fnb-types`: `Topic` view/entity type — drop `context`, add `subjectUrn`.

## §3 App — drop `support_ticket.topic_id`

`db/fnb-app/deploy/00000000010220_app.sql:321`: delete the `,topic_id uuid null` line. No
index, no writer, no reader exists (verified 2026-07-10). Sweep fnb-types/fragments for a
`topicId` selection just in case (none known).

## §4 Sequencing (same shape as v1)

1. DB in-place edits (§1.1–1.4, §2.1–2.3, §3) + verify/revert true-up + server TS (§1.5).
2. **USER REBUILD GATE** — in-place edits are invisible to `sqitch deploy`; ask the user.
3. Codegen against the live schema → client work (§1.6, §2.4) → `pnpm build` gate.
4. R21 doc sync: `asset-storage` spec (context/owning_entity_id references),
   `tenant-app/msg` + `tenant-app/tools/todo` specs (Mode 3 migration notes), this file's
   Status, README task list.

## §5 Verification (read-only, post-rebuild)

- `\d storage.asset` / `\d msg.topic`: old columns gone, `uq_topic_subject_urn` present;
  `storage.asset_context` type absent.
- Upload an asset with `subjectUrn` → appears under `todo { resource { assets } }` and in
  `useSubjectAssets`; anon `publicAssetsForSubjectList` returns clean+public rows only.
- Start a todo discussion → `msg.topic.id ≠ todo.id`, registry has a `('msg','topic')` row,
  `resolveUrn(topic.urn)` returns it, second `startDiscussion` on the same todo upserts (no
  duplicate — unique index).
- Cross-tenant `subjectUrn` on upload/upsert_topic → `30000: NOT AUTHORIZED` (storage) /
  not-found (msg RLS guard).
- `select count(*) from app.support_ticket` sanity + GraphQL `supportTickets` query has no
  `topicId` field.
