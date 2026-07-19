# Spec Plan: `remove-tenant-and-resident-stubs`

> Working notes + draft spec. Deliverable is a new spec at
> `.claude/specs/remove-tenant-and-resident-stubs/` (not yet written — blocked on 4 open decisions below).

## Context

Every feature module (`loc`, `msg`, `todo`, `storage`) currently carries two **shadow tables**:

```
<module>.<module>_tenant   (tenant_id  uuid PK → app.tenant(id),   name         citext)
<module>.<module>_resident (resident_id uuid PK → app.resident(id), tenant_id → _tenant, display_name citext)
```

They are lazy-initialized by `<module>_fn.ensure_<module>_resident(resident_id)` on first write, which
**denormalizes** `display_name`/`tenant_name` out of `app.resident`, and kept in sync by a per-module
`handle_update_profile()` trigger on `app.profile`. Every module's main tables (`loc.location`, `msg.topic`,
`msg.message`, `msg.subscriber`, `todo.todo`, `storage.asset`) FK their `tenant_id`/`resident_id` at these
shadow tables rather than at `app.tenant`/`app.resident` directly.

**Goal:** delete the shadow tables entirely. Store `tenant_id`/`resident_id` as plain `uuid` columns with
**no foreign keys** to `app.tenant`/`app.resident` anywhere. Resolve display names from the real `app.resident`
/ `app.tenant` tables (which already hold all the needed data) instead of the denormalized copies.

**Why this is safe, data-wise:** `app.resident` already has `display_name`, `tenant_id`, `tenant_name`;
`app.tenant` has `name`. The shadow tables were pure denormalized copies — nothing is lost.
`app.resident` also has a `view_all_for_tenant` SELECT RLS policy (`jwt.tenant_id() = tenant_id`), so
same-tenant resident lookups already work for the `authenticated` role.

**Relationship to `0380__db________db-generate-crashes-on-fnb-loc__HI___.plan.md`:** removing the cross-schema FKs to
`app.tenant`/`app.resident` eliminates the `Could not resolve reference {schema:'app'...}` warnings these
modules emit during kanel generation. It does **not** fix the *fatal* crash — that is caused by composite
types in `loc_fn`/`loc_api` (e.g. `search_locations_options` referencing `app_fn.paging_options`) and is a
separate issue with its own suggested fixes. Out of scope here; noted only because the two are thematically
linked.

---

## Exhaustive change inventory (from codebase exploration)

### DB layer — shadow tables to DROP
| Module | File | Shadow tables |
|--------|------|---------------|
| loc | `db/fnb-loc/deploy/00000000010300_loc.sql` | `loc_tenant` (L23), `loc_resident` (L28) |
| msg | `db/fnb-msg/deploy/00000000010400_msg.sql` | `msg_tenant` (L21), `msg_resident` (L26) |
| todo | `db/fnb-todo/deploy/00000000010450_todo.sql` | `todo_tenant` (L28), `todo_resident` (L33) |
| storage | `db/fnb-storage/deploy/00000000010600_storage.sql` | `storage_tenant` (L8), `storage_resident` (L12) |

### DB layer — FK columns to convert to plain uuid (drop the `references ...` clause)
- `loc.location`: `tenant_id` (L36 → app? no; drop FK), `resident_id` (L37)
- `msg.topic.tenant_id` (L35); `msg.message.tenant_id` (L49), `posted_by_msg_resident_id` (L54);
  `msg.subscriber.tenant_id` (L64), `msg_resident_id` (L68)
- `todo.todo.tenant_id` (L43), `resident_id` (L44, nullable — keep nullable)
- `storage.asset.tenant_id` (L20), `resident_id` (L21)

### DB layer — functions/triggers to DELETE
- `ensure_loc_resident` (`.../010310_loc_fn.sql:24`), `ensure_msg_resident` (`010410_msg_fn.sql:24`),
  `ensure_todo_resident` (`010470_todo_fn.sql:32`), `ensure_storage_resident` (`010610_storage_fn.sql:2`).
  No separate `ensure_*_tenant` exists — tenant upsert is inlined in each `ensure_*_resident`.
- Call sites to strip (replace `_x_resident := ensure_...(...)` with direct `jwt.resident_id()` /
  `jwt.tenant_id()` use):
  - loc: `create_location` (`010310_loc_fn.sql:92`)
  - msg: `010410_msg_fn.sql:94, 176, 267`
  - todo: `create_todo` (`010470_todo_fn.sql:117`)
  - storage: `insert_asset` (`010610_storage_fn.sql:49`)
- `handle_update_profile()` + `<module>_on_app_profile_updated` trigger — DELETE for loc/msg/todo
  (`010310_loc_fn.sql:2-22`, `010410_msg_fn.sql:2-22`, `010470_todo_fn.sql:9-29`).
  storage never had one.

### DB layer — RLS policies to DELETE (shadow-table policies)
- msg (`010420_msg_policies.sql`): `msg_tenant`/`msg_resident` policies L31-49 (also fixes the latent bug
  where L31 enables RLS on `msg_resident` twice and never on `msg_tenant`).
- todo (`010480_todo_policies.sql`): `todo_tenant`/`todo_resident` policies L31-50.
- storage (`010620_storage_policies.sql`): `storage_tenant`/`storage_resident` policies + their grants L34-49.
- loc: none (shadow tables never had policies).
- Keep all main-table policies (`loc.location`, `msg.topic/message/subscriber`, `todo.todo`,
  `storage.asset`) — they already filter by `jwt.tenant_id()` / `jwt.has_permission(..., tenant_id)`,
  which continues to work against the plain `tenant_id` column.

### db-types layer (`packages/db-types/`)
- **Regenerated automatically** by `pnpm db-generate` once DB changes deploy: `Msg/Todo/StorageResident.ts`,
  `*Tenant.ts`, `*Schema.ts`, and the branded-id imports in `Message.ts`/`Subscriber.ts`/`Topic.ts`/`Todo.ts`.
  (Note: `fnb-loc`/`fnb-wf` currently produce **no** generated output — consistent with the db-generate
  crash aborting before them.)
- **Hand-edit required:**
  - `src/queries/msg.ts` — `msgWithSenderBase()` (L59) and `selectMySubscribedTopics()` (L97) join to
    `msg.msgResident`; repoint to `app.resident` (join on `app.resident.id`).
  - `src/mutations/fnb-msg/upsert-subscriber.ts` (and check `upsert-message.ts`) — field names carrying
    `msgResidentId`.
- Verify `src/index.ts` barrel after regen (per CLAUDE.md — the #1 miss).

### graphql-client-api layer (`packages/graphql-client-api/`)
- **`.graphql` ops to rewrite** (relationship selections that vanish):
  - todo: `todoById.graphql` (`owner: resident{…}`), `searchTodos.graphql` (`resident{…}`, `tenant{…}`),
    `assignTodo.graphql` (`owner: resident{…}`), `todoResidentsList.graphql` (dead/unused — delete).
  - msg: `discussions/fragment/Message.graphql` (`postedBy: postedByMsgResident{…}`),
    `discussions/fragment/Subscriber.graphql` (`msgResident{…}`),
    `msg/query/mySubscribedTopics.graphql` (`msgResident{…}` ×2).
  - loc: none. `discussions/query/msgResidents.graphql` uses real `residentsList` (app.resident) — leave.
- **Composables to remap:** `useTodoDetail.ts`, `useTodoList.ts`, `useMsgTopic.ts`, `useMsgTopics.ts`,
  `useTodoMsg.ts` — return the same shapes UI expects, resolving displayName from a residents map.
- Regenerate `src/generated/fnb-graphql-api.ts` via `pnpm -F @function-bucket/fnb-graphql-client-api generate`.

### App / UI layer (`apps/tenant-app/`)
- **No UI changes** if composables preserve their return shapes (`owner: {residentId, displayName}`,
  `senderDisplayName`, etc.). Components (`TodoDetail.vue`, `TodoDetailAssign.vue`, `TodoDetailSmall.vue`,
  `Msg.vue`, `msg/*`) use ad-hoc local types, not shadow-table imports.
- loc pages/composables: fully clean, zero changes.
- `apps/graphql-api-app/server/graphile.config.ts`: auto-exposes all tables, no allowlist. Shadow types
  disappear automatically once tables are dropped — no config edit needed (unless smart-tag option chosen).

---

## OPEN DECISIONS (blocking — was about to ask the user; interrupted)

1. **Display-name resolution** — (A, recommended) rewrite `.graphql` to scalar `residentId`/`tenantId` +
   resolve `displayName` in composables from a loaded `residentsList` map + `ProfileClaims.tenantName`;
   truly zero FK, no UI change, composable-only churn. vs (B) PostGraphile `@foreignKey` smart tags in
   `postgraphile.tags.json5` → app.resident/app.tenant; lowest churn but re-creates virtual FKs (against
   the stated "no foreign keys anywhere" goal).
2. **Module scope** — all four (loc/msg/todo/storage) vs loc/msg/todo only (leave in-flight storage to the
   asset-storage spec).
3. **Migration style** — edit sqitch deploy/revert/verify files in place (fresh-rebuild convention) vs
   additive timestamped ALTER migrations.
4. **Column naming** — keep `posted_by_msg_resident_id`/`msg_resident_id` (min churn) vs rename to
   `posted_by_resident_id`/`resident_id` (cleaner, more churn).

Recommended defaults if user defers: **1A, 2 all-four, 3 in-place, 4 keep names.**

---

## Verification (once implemented)
1. `pnpm db-generate` completes and regenerates `fnb-msg`/`fnb-todo`/`fnb-storage` (and ideally
   `fnb-loc`) without the shadow types.
2. `pnpm -F @function-bucket/fnb-graphql-client-api generate` + `build` clean (no TS errors).
3. Ask user to rebuild Docker (never self-rebuild — per memory), then read-only verify:
   - todo list/detail show owner display names; assign works.
   - msg conversation shows sender names + participant names.
   - loc unchanged.
   - Network tab: `POST /graphql-api/api/graphql` succeeds, no missing-field errors.
