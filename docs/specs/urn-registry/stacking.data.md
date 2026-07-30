# URN Registry — First Stacking Consumer: storage `subject_urn`

## Status
Implemented — 2026-07-10 (see §3 correction: the visibility guard mirrors the registry
policy via `jwt.*` — insert_asset is SECURITY DEFINER).

---

## 1. What stacking means here

A stacking column points a capability row at *any* registered business object:

```
storage.asset.subject_urn ──FK──▶ res.resource.urn ◀──1:1── todo.todo / msg.topic / loc.location / …
```

Direction rule (from the analysis): **capability modules point at business objects, never the
reverse.** No business table grows an `asset_id`.

## 2. Schema change (edited in-place into `db/fnb-storage/deploy/00000000010600_storage.sql` — `_shared.data.md` §4 strategy)

```sql
-- in CREATE TABLE storage.asset:
,subject_urn text NULL REFERENCES res.resource(urn)
-- after it:
CREATE INDEX idx_asset_subject_urn ON storage.asset (subject_urn)
  WHERE subject_urn IS NOT NULL;
```

- Nullable — an asset without a subject is still valid (today's behavior).
- The index is mandatory: it powers the hub reverse relation and PostGraphile v5
  condition/filter generation.
- ~~**Coexistence, not replacement:** the existing `context` + `owning_entity_id` loose-ref
  columns stay untouched in v1.~~ **Superseded by v2** (`stacking-v2.data.md`, 2026-07-10):
  `context`, `owning_entity_id`, and the `asset_context` enum are removed — `subject_urn` is
  the only attach mechanism.

## 3. Write path

Two storage create sites (see `_shared.data.md` §5 table):

1. **Upload endpoint carve-out** (`packages/storage-layer/server/api/upload.post.ts` →
   `storage_fn` create, `db/fnb-storage/deploy/00000000010610_storage_fn.sql:52`): accept an
   optional `subjectUrn` form field, thread it through the `_fn` create signature into the
   insert. The FK validates existence; visibility needs an explicit guard in `_fn`.
   **Correction (implementation 2026-07-10):** `storage_fn.insert_asset` is SECURITY DEFINER,
   so RLS on `res.resource` does NOT fire inside it — the guard cannot be a plain RLS-filtered
   select. It mirrors the registry SELECT policy explicitly via `jwt.*` (claims are in scope:
   the endpoint runs under `withClaims`, 2-arg — R5 carve-out): super-admin, or the
   `res.module_permission` check against the subject's module/tenant; on miss raise
   `30000: NOT AUTHORIZED`. See the guard block in
   `db/fnb-storage/deploy/00000000010610_storage_fn.sql`.
2. **Scan-derivative insert** (`…10625_storage_resolve_asset_scan.sql:81`): the clean-copy
   asset inherits `subject_urn` from its parent asset. No new input.

Optional re-parenting (`storage_api.set_asset_subject(_asset_id, _subject_urn)`) is **out of
scope v1** — attach at upload time only.

## 4. The hub query shape (the payoff)

```graphql
query TodoWithAttachments($id: UUID!) {
  todo(id: $id) {
    id name urn
    resource {                     # todo.id → res.resource (the deferred FK)
      urn
      assets { id originalName downloadUrl }   # res.resource ← storage.asset.subject_urn
    }
  }
}
```

- `Todo` deliberately has **no** `assets` field — the hub hop keeps module schemas decoupled.
  Every future stacking module's reverse relation accumulates on `Resource` automatically.
- RLS empties any branch the caller lacks: no `p:app-user` storage visibility ⇒ `assets: []`
  even though the field exists in the schema.
- Exact generated field names (`assets` vs `assetsBySubjectUrn`, `resource` vs
  `resourceById`) are fixed by simplify-inflection + smart tags at implementation; record the
  actuals in `client.data.md` after codegen.

## 5. Known Gaps / future

- Attachment panels in tenant-app UI (list assets for a subject, upload-against-subject) —
  **no UI in this spec**; a future `tenant-app/…` spec owns pages/components (R18 applies
  when pages appear).
- ~~`msg.topic.subject_urn` (discussions about an object)~~ — **shipped in v2**
  (`stacking-v2.data.md`, 2026-07-10), which also ends the `context`/`owning_entity_id`
  coexistence noted in §2. `wf.wf.subject_urn` (workflow
  provenance) — same recipe, follow-up change. With
  tenants/residents registered (`_shared.data.md` §5), tenant logos / user avatars /
  discussions-about-a-user become plain stacking cases — no schema work needed beyond these
  columns.
- Generic `res.link(src_urn, dst_urn, relation)` edge table — documented escape hatch only;
  an explicit column beats a generic edge table until a real many-to-many case demands it.
