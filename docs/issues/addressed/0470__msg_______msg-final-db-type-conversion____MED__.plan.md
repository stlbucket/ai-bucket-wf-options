# Jettison Kysely / retire `fnb-db-types` entirely

## Context
The residency/support (§C) GraphQL conversion is done. Four files are the **only** remaining
`fnb-db-types` importers, and all of Kysely now hangs off one path: the WebSocket "new message"
incremental read. Goal: move that path into the raw-`pg` `fnb-db-access` lib, delete the Kysely
`db.ts` plugins, and remove the `fnb-db-types` package outright.

Remaining importers (confirmed):
- `apps/auth-app/server/plugins/db.ts` — `createDb`, `Database` (sets `event.context.db`)
- `packages/tenant-layer/server/plugins/db.ts` — `createDb`, `Database`, `ProfileClaims`
  (sets `event.context.db`, `nitroApp.db`, and the `user`/`claims` H3 context type augmentation)
- `packages/msg-layer/server/api/topics/[id]/messages/[msgId].get.ts` — `withClaims`,
  `selectMessageWithSenderById` (the WS read — the only real Kysely query left)
- `packages/msg-layer/server/utils/getWsUpgradeClaims.ts` — `Database` (type-only; the `db` param is
  just a readiness gate)

Verified facts that make this safe:
- `event.context.db` is consumed **only** by `[msgId].get.ts`; `nitroApp.db` **only** by the
  `getWsUpgradeClaims` readiness gate. All other data access is already GraphQL/db-access.
- The pg-notify bridge (`packages/msg-layer/server/plugins/pg-notify-bridge.ts`) uses its **own
  `pg.Client`** from `DATABASE_URL` — it does **not** touch the Kysely `db`, so removing the plugins
  doesn't affect real-time delivery.
- `auth-app/server/plugins/db.ts` is **already dead** — after §C, nothing in auth-app reads
  `event.context.db` (login → db-access, middleware → db-access). It can be deleted immediately.
- The `user`/`claims` `H3EventContext` type augmentation currently lives inside tenant-layer's
  `db.ts`; it must be **relocated** before deleting that file (see B4).

## Track A — prune dead db-types hand-written surface (safe, no dependency on the WS read)
Nothing outside db-types imports these. Delete `src/mutations/**` (fnb-app, fnb-auth, fnb-msg),
`src/queries/resident.ts`, `src/utils/parse-modules.ts`; trim `src/queries/msg.ts` to just
`msgWithSenderBase` + `selectMessageWithSenderById` + `MessageWithSender`; prune the `src/index.ts`
barrel to `@/generated`, `Database`+`createDb`, `@/with-claims`, `@/queries/msg`. `pnpm build` gate.
(This is subsumed by Track B's final deletion, but is a safe standalone step if done first.)

## Track B — move the WS path to db-access, then delete Kysely

### B1. db-access: add `withClaims` + the raw query
- `packages/db-access/src/jwt.ts` — port `buildJwtPayload(claims)` from
  `packages/db-types/src/with-claims.ts` (identical `{ email, display_name, user_metadata:{ profile_id,
  tenant_id, resident_id, actual_resident_id, permissions } }` shape RLS expects), typed over the
  db-access `ProfileClaims`.
- `packages/db-access/src/with-claims.ts` — transaction on a pooled client (mirrors the Kysely
  version's `set local role authenticated` + `set_config`):
  ```ts
  import type { PoolClient } from 'pg'
  import { getPool } from '@/pool'
  import { buildJwtPayload } from '@/jwt'
  import type { ProfileClaims } from '@/types/profile-claims'

  export async function withClaims<T>(claims: ProfileClaims, fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool().connect()
    try {
      await client.query('begin')
      await client.query('set local role authenticated')
      await client.query(`select set_config('request.jwt.claims', $1, true)`,
        [JSON.stringify(buildJwtPayload(claims))])
      const out = await fn(client)
      await client.query('commit')
      return out
    } catch (e) { await client.query('rollback'); throw e }
    finally { client.release() }
  }
  ```
- `packages/db-access/src/queries/msg.ts` — raw-pg `selectMessageWithSenderById(client, id)` reusing
  the existing `MessageWithSender` type (`src/types/message-with-sender.ts`) and `camelCaseKeys`:
  ```ts
  export async function selectMessageWithSenderById(client: PoolClient, id: string): Promise<MessageWithSender | undefined> {
    const { rows } = await client.query(
      `select m.id, m.topic_id, m.content, m.created_at, m.status, m.posted_by_msg_resident_id,
              r.display_name as sender_display_name
         from msg.message m
         left join msg.msg_resident r on r.resident_id = m.posted_by_msg_resident_id
        where m.status != 'deleted' and m.id = $1`, [id])
    return rows[0] ? camelCaseKeys<MessageWithSender>(rows[0]) : undefined
  }
  ```
- Export `withClaims`, `buildJwtPayload`, `selectMessageWithSenderById` from `src/index.ts`; rebuild.

### B2. Rewrite the WS read (`[msgId].get.ts`)
```ts
import { withClaims, selectMessageWithSenderById } from '@function-bucket/fnb-db-access'
export default defineEventHandler(async (event) => {
  const { claims } = event.context
  if (!claims) throw createError({ statusCode: 401, message: 'Not authenticated' })
  const msgId = getRouterParam(event, 'msgId')!
  return withClaims(claims, (client) => selectMessageWithSenderById(client, msgId))
})
```
No more `event.context.db`.

### B3. Drop the `getWsUpgradeClaims` readiness gate
Remove the `db: Kysely<Database>` param and the `Database` import; wrap the db-access claims call so a
DB-down/error yields "no claims" (→ 401) instead of throwing out of the upgrade:
```ts
export async function getWsUpgradeClaims(headers: Headers) {
  const userId = /* parse session cookie as today */
  if (!userId) return { user: undefined, claims: undefined }
  try {
    const claims = await profileClaimsForUser(userId)
    return claims ? { user: { id: userId }, claims } : { user: undefined, claims: undefined }
  } catch { return { user: undefined, claims: undefined } }
}
```
Update the caller `packages/msg-layer/server/routes/_ws/topics/[id]/messages.ts` to
`getWsUpgradeClaims(headers)` (drop `useNitroApp().db`).

### B4. Relocate the context types, delete the Kysely plugins
- Move the `user`/`claims` `H3EventContext` augmentation out of tenant-layer `db.ts` into a shared
  auth-layer module (e.g. add to `packages/auth-layer/server/utils/applyEventClaims.ts` or a small
  `server/types.ts`), typed with the **db-access** `ProfileClaims`. Drop the `db` and nitropack
  `NitroApp.db` augmentations (no longer referenced).
- Delete `apps/auth-app/server/plugins/db.ts` and `packages/tenant-layer/server/plugins/db.ts`.
  (`applyEventClaims`/`getEventClaims` already run off db-access, so `event.context.claims` is
  unaffected.)

### B5. Remove the `fnb-db-types` package
After B1–B4 nothing imports it. Delete `packages/db-types`; remove its `workspace:*` entry from every
consumer `package.json`; drop the `@function-bucket/fnb-db-types` string from
`packages/auth-ui/vite.config.ts` externals; remove the `fnb-db-types` build/watch + healthcheck
entries from `docker-compose.yml` `packages-watch`. `pnpm install` + `pnpm build`.

## Verification
- `pnpm build` green; `grep -r "@function-bucket/fnb-db-types"` over source returns nothing.
- Manual (Docker rebuild — new package files + removed package both require it): live discussions
  still work end-to-end — send a message, a second subscribed peer receives it via the pg-notify
  bridge and the incremental `[msgId]` read returns the message **with sender display name**
  (validates the db-access `withClaims` role/claims scoping + the raw join). Login / nav / permissions
  unaffected; WS upgrade still 401s when unauthenticated.
