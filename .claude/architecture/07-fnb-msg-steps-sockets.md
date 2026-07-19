# Adding the fnb-msg Stack with WebSockets — Step-by-Step

> This is a variant of `07-fnb-msg-steps.md`. Phases 1–2 (DB + db-types) are identical.
> Phases 3–6 differ: all shareable artifacts (components, composables, pages, server routes,
> WS handler, pg bridge) move into `packages/msg-layer/` so any app can reuse them by
> extending the layer. `apps/msg-app` becomes a thin host.

## What Already Exists vs What Needs Building

### Already exists (DB layer is complete)
- `db/fnb-msg/` — full sqitch package deployed
- `msg.topic`, `msg.message`, `msg.subscriber`, `msg.msg_tenant`, `msg.msg_resident` tables
- `msg_api.upsert_topic`, `msg_api.upsert_message`, `msg_api.upsert_subscriber`, `msg_api.deactivate_subscriber`, `msg_api.delete_topic`
- `app_fn.tg__graphql_subscription` — real-time trigger that fires `pg_notify` on `msg.message` INSERT
- RLS policies on all msg tables (require `p:app-admin` or `p:app-user` permission)
- `msg_fn.ensure_msg_resident()` — lazy-create shadow resident on first use

### NOT yet built
- TypeScript types and query helpers in `packages/db-types`
- Nuxt layer package for msg
- Nuxt app for msg (or integration into existing app)
- Server API routes
- Vue pages and components
- Nav section registration
- Real-time WebSocket wiring

---

## Architecture Decision: Separate App or Integrated?

**Option A: New `packages/msg-layer` + `apps/msg-app`** (follows the established pattern)
- Pros: clean separation, own port/subdomain, independently deployable
- Cons: another app to maintain, another nav registration

**Option B: Add msg pages/routes into `tenant-app`**
- Pros: already has tenant-scoped routes and auth infrastructure
- Cons: couples feature to tenant-app

This guide follows **Option A** (separate layer + app), matching the project's established pattern.

---

## Layer vs App: Where Things Live

The key architectural principle for reusability: **everything that could be used by more than one
app belongs in `packages/msg-layer/`**, not in `apps/msg-app/`.

Nuxt layers automatically expose to every app that extends them:
- `app/components/` → auto-imported components
- `app/composables/` → auto-imported composables
- `app/pages/` → merged route tree
- `server/api/` → merged API routes
- `server/routes/` → merged server routes (including WS handlers)
- `server/plugins/` → merged Nitro plugins
- `server/middleware/` → merged middleware

`apps/msg-app/` therefore contains only three files:

| File | Purpose |
|------|---------|
| `package.json` | declares `@function-bucket/fnb-msg-layer` dependency |
| `nuxt.config.ts` | extends msg-layer, enables `features.websocket: true` |
| `app.vue` | optional app shell |

**Adding msg to a second app** (e.g. `tenant-app`) requires only two steps:
1. Add `@function-bucket/fnb-msg-layer` to its `extends` array
2. Ensure `nitro.features.websocket: true` in its `nuxt.config.ts` (already present in tenant-app)

Each app gets its own Nitro process with its own pg bridge client and its own crossws pub/sub
namespace — this is correct. Peers on `tenant-app` and `msg-app` are isolated from each other.

## Phase 1 - <deleted>

## Phase 2 — db-types: TypeScript Types and Query Helpers

### 2a. Regenerate types

```bash
pnpm db-generate
```

This runs Kanel and regenerates `packages/db-types/src/generated/fnb-msg/msg/` with TypeScript types for `Topic`, `Message`, `Subscriber`, `MsgTenant`, `MsgResident`.

### 2b. Add query helpers

**File: `packages/db-types/src/queries/msg.ts`**

```typescript
import type { Kysely, Transaction } from 'kysely'
import type { Database } from '../db'

export function selectTopicsByTenantId(db: Kysely<Database> | Transaction<Database>, tenantId: string) {
  return db
    .selectFrom('msg.topic')
    .where('tenant_id', '=', tenantId)
    .orderBy('created_at', 'desc')
    .selectAll()
    .execute()
}

export function selectTopicById(db: Kysely<Database> | Transaction<Database>, id: string) {
  return db
    .selectFrom('msg.topic')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export function selectMessagesByTopicId(db: Kysely<Database> | Transaction<Database>, topicId: string) {
  return db
    .selectFrom('msg.message')
    .where('topic_id', '=', topicId)
    .where('status', '!=', 'deleted')
    .orderBy('created_at', 'asc')
    .selectAll()
    .execute()
}

export function selectMessageById(db: Kysely<Database> | Transaction<Database>, id: string) {
  return db
    .selectFrom('msg.message')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}
```

### 2c. Add mutation wrappers

**File: `packages/db-types/src/mutations/fnb-msg/upsert-topic.ts`**

```typescript
import { sql } from 'kysely'
import type { Kysely, Transaction } from 'kysely'
import type { Database } from '../../db'

export async function upsertTopic(
  db: Kysely<Database> | Transaction<Database>,
  topicInfo: { name: string; identifier?: string; status?: string }
) {
  const { rows } = await sql<{ upsert_topic: unknown }>`
    SELECT msg_api.upsert_topic(ROW(
      NULL::uuid,
      ${sql.val(topicInfo.name)}::citext,
      ${sql.val(topicInfo.identifier ?? null)}::citext,
      ${sql.val(topicInfo.status ?? 'open')}::msg.topic_status
    )::msg_fn.topic_info)
  `.execute(db)
  return rows[0]
}
```

**File: `packages/db-types/src/mutations/fnb-msg/upsert-message.ts`**

```typescript
export async function upsertMessage(
  db: Kysely<Database> | Transaction<Database>,
  messageInfo: { topicId?: string; content: string; tags?: string[] }
) {
  const { rows } = await sql<{ upsert_message: unknown }>`
    SELECT msg_api.upsert_message(ROW(
      NULL::uuid,
      ${sql.val(messageInfo.topicId ?? null)}::uuid,
      ${sql.val(messageInfo.content)}::citext,
      ${sql.val(messageInfo.tags ?? [])}::text[]
    )::msg_fn.message_info)
  `.execute(db)
  return rows[0]
}
```

### 2d. Export from db-types index

**File: `packages/db-types/src/index.ts`** — add:
```typescript
export * from './queries/msg'
export * from './mutations/fnb-msg/upsert-topic'
export * from './mutations/fnb-msg/upsert-message'
```

---

## Phase 3 — Nuxt Layer: `packages/msg-layer`

### File: `packages/msg-layer/package.json`

```json
{
  "name": "@function-bucket/fnb-msg-layer",
  "version": "0.0.1",
  "dependencies": {
    "@function-bucket/fnb-auth-layer": "workspace:*",
    "@function-bucket/fnb-db-types": "workspace:*"
  }
}
```

### File: `packages/msg-layer/nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  extends: ['@function-bucket/fnb-auth-layer'],
})
```

### File: `packages/msg-layer/app/plugins/nav-register.ts`

```typescript
export default defineNuxtPlugin(() => {
  const { register } = useNavRegistry()
  register([
    {
      title: 'Discussions',
      permissionKey: ['p:app-admin', 'p:app-user'],
      items: [
        { label: 'Topics', route: '/messages', icon: 'i-lucide-messages-square' },
      ]
    }
  ])
})
```

### File: `packages/msg-layer/app/pages/messages/index.vue`

```vue
<script setup lang="ts">
const { data: topics } = await useFetch('/api/topics')
</script>

<template>
  <UCard header="Topics">
    <TopicList :topics="topics" />
    <UButton @click="newTopicModalOpen = true">New Topic</UButton>
  </UCard>
</template>
```

### File: `packages/msg-layer/app/pages/messages/[id].vue`

```vue
<script setup lang="ts">
const route = useRoute()
const { data: topic } = await useFetch(`/api/topics/${route.params.id}`)
const { messages } = useTopicMessages(route.params.id as string)
</script>

<template>
  <div class="flex flex-col h-full">
    <UCard class="flex-1 overflow-y-auto">
      <MessageThread :messages="messages" />
    </UCard>
    <!-- No @sent listener needed — WebSocket push appends new messages automatically -->
    <MessageComposer :topic-id="route.params.id as string" />
  </div>
</template>
```

### Components to create (in `packages/msg-layer/app/components/`)

| Component | Props |
|-----------|-------|
| `TopicList.vue` | `topics: Topic[]` |
| `MessageThread.vue` | `messages: Message[]` |
| `MessageComposer.vue` | `topicId: string` |

---

## Phase 4 — Nuxt App: `apps/msg-app` (thin host)

`apps/msg-app` has no pages, components, or server files of its own. It is purely a host
that extends the layer and configures the runtime environment.

### File: `apps/msg-app/nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  extends: ['@function-bucket/fnb-msg-layer'],
  runtimeConfig: {
    cookieDomain: '',
    public: {
      authAppUrl: process.env.AUTH_APP_URL ?? 'http://localhost:4000/auth',
    }
  },
  nitro: {
    features: {
      websocket: true  // required: enables WS handler inherited from the layer
    }
  }
})
```

---

## Phase 5 — Server Routes (in `packages/msg-layer/server/`)

All server files live in `packages/msg-layer/server/` so they are inherited by every app
that extends the layer.

### File: `packages/msg-layer/server/middleware/auth.ts`

```typescript
import { getH3EventClaims } from './_common/get-h3-event-claims'

export default defineEventHandler(async (event) => {
  const { user, claims } = await getH3EventClaims(event)
  event.context.user = user
  event.context.claims = claims
})
```

### File: `server/plugins/db.ts`

```typescript
import { createDb } from '@function-bucket/fnb-db-types'

export default defineNitroPlugin((nitro) => {
  const db = createDb(process.env.DATABASE_URL!)
  nitro.hooks.hook('request', (event) => {
    event.context.db = db
  })
})
```

### File: `server/api/topics/index.get.ts`

```typescript
import { withClaims, selectTopicsByTenantId } from '@function-bucket/fnb-db-types'

export default defineEventHandler(async (event) => {
  const { db, claims } = event.context
  if (!claims) throw createError({ statusCode: 401 })
  return withClaims(db, claims, (trx) => selectTopicsByTenantId(trx, claims.tenantId!))
})
```

### File: `server/api/topics/[id]/messages/index.get.ts`

```typescript
import { withClaims, selectMessagesByTopicId } from '@function-bucket/fnb-db-types'

export default defineEventHandler(async (event) => {
  const { db, claims } = event.context
  if (!claims) throw createError({ statusCode: 401 })
  const topicId = getRouterParam(event, 'id')!
  return withClaims(db, claims, (trx) => selectMessagesByTopicId(trx, topicId))
})
```

### File: `server/api/topics/[id]/messages/[msgId].get.ts`

```typescript
import { withClaims, selectMessageById } from '@function-bucket/fnb-db-types'

export default defineEventHandler(async (event) => {
  const { db, claims } = event.context
  if (!claims) throw createError({ statusCode: 401 })
  const msgId = getRouterParam(event, 'msgId')!
  return withClaims(db, claims, (trx) => selectMessageById(trx, msgId))
})
```

### File: `server/api/topics/[id]/messages/index.post.ts`

```typescript
import { withClaims, upsertMessage } from '@function-bucket/fnb-db-types'

export default defineEventHandler(async (event) => {
  const { db, claims } = event.context
  if (!claims) throw createError({ statusCode: 401 })
  const topicId = getRouterParam(event, 'id')!
  const body = await readBody<{ content: string }>(event)
  // INSERT fires _500_gql_insert trigger → pg_notify('topic:<topicId>:message', ...)
  return withClaims(db, claims, (trx) => upsertMessage(trx, { topicId, content: body.content }))
})
```

---

## Phase 6 — Real-Time via WebSocket + `pg_notify`

### 6a. How the existing trigger works

The trigger is already deployed in `db/fnb-msg/deploy/00000000010410_msg_fn.sql`:

```sql
CREATE OR REPLACE TRIGGER _500_gql_insert
  AFTER INSERT ON msg.message
  FOR EACH ROW
  EXECUTE FUNCTION app_fn.tg__graphql_subscription(
    'create',
    'topic:$1:message',   -- channel: 'topic:<topic_id>:message'
    'topic_id'
  );
```

Every INSERT fires:

```
pg_notify('topic:<topicId>:message',
  '{"event":"create","subject":"<topicId>","id":"<messageId>"}')
```

No DB changes are needed. The challenge is bridging that notify to connected browsers.

### 6b. Server: global pg bridge plugin

Rather than creating a pg connection per WebSocket peer (which leaks connections at scale),
a single Nitro plugin owns one persistent pg client and ref-counts LISTEN/UNLISTEN as
topic subscriptions change across all connected peers.

**File: `apps/msg-app/server/plugins/pg-notify-bridge.ts`**

```typescript
import { Client } from 'pg'

declare module 'nitropack' {
  interface NitroApp {
    pgBridge: {
      subscribe(channel: string, peer: any): Promise<void>
      unsubscribe(channel: string, peer: any): Promise<void>
    }
  }
}

export default defineNitroPlugin(async (nitro) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL! })
  await client.connect()

  const refCounts = new Map<string, number>()

  client.on('notification', (msg) => {
    if (!msg.channel || !msg.payload) return
    // crossws pub/sub: forwards payload to all peers subscribed to this channel
    nitro.h3App.websocket?.publish?.(msg.channel, msg.payload)
  })

  nitro.pgBridge = {
    async subscribe(channel, peer) {
      const count = refCounts.get(channel) ?? 0
      if (count === 0) await client.query(`LISTEN "${channel}"`)
      refCounts.set(channel, count + 1)
      peer.subscribe(channel)  // crossws in-memory subscription
    },
    async unsubscribe(channel, peer) {
      const count = (refCounts.get(channel) ?? 1) - 1
      peer.unsubscribe(channel)
      if (count <= 0) {
        refCounts.delete(channel)
        await client.query(`UNLISTEN "${channel}"`)
      } else {
        refCounts.set(channel, count)
      }
    }
  }

  nitro.hooks.hookOnce('close', () => client.end())
})
```

**Why a single pg client?** Postgres supports unlimited LISTEN channels per connection.
One persistent client handles all active topics with zero per-peer overhead.

**Why ref-count?** Multiple peers watching the same topic share one LISTEN.
UNLISTEN fires only when the last peer leaves, not on every disconnect.

### 6c. Server: WebSocket route handler

**File: `apps/msg-app/server/routes/_ws/topics/[id]/messages.ts`**

```typescript
import { getH3EventClaims } from '../../../_common/get-h3-event-claims'

export default defineWebSocketHandler({
  async upgrade(request) {
    // Runs before the handshake is accepted.
    // Throw a Response to reject the connection with an HTTP status code.
    // Return { context } to attach data available in all subsequent hooks.
    const { claims } = await getH3EventClaims(request as any)
    if (!claims) throw new Response('Unauthorized', { status: 401 })
    return { context: { claims } }
  },

  async open(peer) {
    const topicId = new URL(peer.request!.url, 'http://x').pathname.split('/')[4]
    if (!topicId) { peer.close(1008, 'Missing topic ID'); return }

    peer.context.topicId = topicId
    await useNitroApp().pgBridge.subscribe(`topic:${topicId}:message`, peer)
  },

  async close(peer) {
    const { topicId } = peer.context
    if (topicId) {
      await useNitroApp().pgBridge.unsubscribe(`topic:${topicId}:message`, peer)
    }
  },

  error(peer, error) {
    console.error('[ws] error for peer', peer.id, error)
  }
})
```

**Authentication notes:**
- `upgrade` fires before the handshake. A thrown `Response(401)` sends an HTTP error —
  no half-open WebSocket connection is ever established.
- `peer.context.claims` set in `upgrade` is available in `open`, `close`, and `message`.
- `getH3EventClaims` reads the `session` cookie and calls `appFn.profileClaimsForUser` —
  the same path every HTTP API route uses. The browser sends the `session` cookie
  automatically on the upgrade request because it shares the same origin.

**Pub/Sub flow (per message insert):**
1. `peer.subscribe(channel)` — registers peer in crossws in-memory pub/sub
2. Postgres INSERT fires trigger → `pg_notify('topic:<id>:message', payload)`
3. pg bridge's `client.on('notification')` receives it
4. `nitro.h3App.websocket?.publish?.(channel, payload)` — crossws fans out to all subscribed peers
5. Each peer's browser receives the payload as a WebSocket `message` event

### 6d. Client: composable

**File: `apps/msg-app/app/composables/useTopicMessages.ts`**

```typescript
import type { Message } from '@function-bucket/fnb-db-types'

export function useTopicMessages(topicId: MaybeRef<string>) {
  const messages = ref<Message[]>([])
  const id = toRef(topicId)

  // Initial HTTP load
  const { data: initial } = useFetch<Message[]>(() => `/api/topics/${id.value}/messages`)
  watch(initial, (val) => { if (val) messages.value = val }, { immediate: true })

  // Real-time push
  let ws: WebSocket | null = null

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${protocol}//${location.host}/_ws/topics/${id.value}/messages`)

    ws.addEventListener('message', async (event) => {
      const notification = JSON.parse(event.data) as { event: string; id: string }
      if (notification.event === 'create') {
        const msg = await $fetch<Message>(`/api/topics/${id.value}/messages/${notification.id}`)
        messages.value.push(msg)
      }
    })

    ws.addEventListener('close', (e) => {
      // Reconnect on unexpected close; 1000 = intentional (component unmount)
      if (e.code !== 1000) setTimeout(connect, 2000)
    })
  }

  onMounted(connect)
  onUnmounted(() => ws?.close(1000, 'unmounted'))

  return { messages }
}
```

**Why not VueUse `useWebSocket`?** VueUse's composable runs during SSR setup and requires
`immediate: false` guards to avoid server-side execution. Using native WebSocket inside
`onMounted` sidesteps SSR entirely and keeps the reconnect logic explicit.

---

## Complete File Checklist

### Database
- [ ] `db/fnb-msg-app/sqitch.conf`
- [ ] `db/fnb-msg-app/sqitch.plan`
- [ ] `db/fnb-msg-app/deploy/00000000010600_msg_app.sql`
- [ ] `db/fnb-msg-app/revert/00000000010600_msg_app.sql`
- [ ] `db/fnb-msg-app/verify/00000000010600_msg_app.sql`

### db-types package
- [ ] Run `pnpm db-generate` → auto-generates `packages/db-types/src/generated/fnb-msg/`
- [ ] `packages/db-types/src/queries/msg.ts` (includes `selectMessageById`)
- [ ] `packages/db-types/src/mutations/fnb-msg/upsert-topic.ts`
- [ ] `packages/db-types/src/mutations/fnb-msg/upsert-message.ts`
- [ ] Update `packages/db-types/src/index.ts` to export new functions

### msg-layer package
- [ ] `packages/msg-layer/package.json`
- [ ] `packages/msg-layer/nuxt.config.ts`
- [ ] `packages/msg-layer/app/plugins/nav-register.ts`

### msg-app
- [ ] `apps/msg-app/package.json`
- [ ] `apps/msg-app/nuxt.config.ts` (with `features.websocket: true`)
- [ ] `apps/msg-app/app/app.vue`
- [ ] `apps/msg-app/app/pages/messages/index.vue`
- [ ] `apps/msg-app/app/pages/messages/[id].vue`
- [ ] `apps/msg-app/app/components/TopicList.vue`
- [ ] `apps/msg-app/app/components/MessageThread.vue`
- [ ] `apps/msg-app/app/components/MessageComposer.vue`
- [ ] `apps/msg-app/app/composables/useTopicMessages.ts`
- [ ] `apps/msg-app/server/middleware/auth.ts`
- [ ] `apps/msg-app/server/plugins/db.ts`
- [ ] `apps/msg-app/server/plugins/pg-notify-bridge.ts` ← WebSocket addition
- [ ] `apps/msg-app/server/_common/get-h3-event-claims.ts` (copy from auth-app)
- [ ] `apps/msg-app/server/api/topics/index.get.ts`
- [ ] `apps/msg-app/server/api/topics/index.post.ts`
- [ ] `apps/msg-app/server/api/topics/[id].get.ts`
- [ ] `apps/msg-app/server/api/topics/[id]/messages/index.get.ts`
- [ ] `apps/msg-app/server/api/topics/[id]/messages/[msgId].get.ts` ← needed for push fetch
- [ ] `apps/msg-app/server/api/topics/[id]/messages/index.post.ts`
- [ ] `apps/msg-app/server/routes/_ws/topics/[id]/messages.ts` ← WebSocket handler

---

## End-to-End Flow

```
User B POSTs /api/topics/<id>/messages
  ↓  withClaims → upsertMessage → INSERT into msg.message
  ↓  trigger: _500_gql_insert
  ↓  pg_notify('topic:<id>:message', '{"event":"create","id":"<msgId>"}')
  ↓  pg bridge client.on('notification') fires
  ↓  nitro.h3App.websocket.publish('topic:<id>:message', payload)
  ↓  crossws delivers to all peers subscribed to that channel
  ↓  User A's browser receives WebSocket message event
  ↓  useTopicMessages: $fetch /api/topics/<id>/messages/<msgId>
  ↓  messages.value.push(msg) → MessageThread re-renders
```

---

## Caveats

**Horizontal scaling:** The pg bridge and crossws pub/sub are in-memory per Nitro instance.
In a multi-instance deploy, each instance has its own pg LISTEN client but crossws cannot
fan out across instances — peers on different nodes miss each other's messages. Fix options:
- Sticky-session load balancer (all WS clients for a topic land on one node)
- Replace crossws in-memory pub/sub with a Redis adapter

**Auth cookie scope:** The `session` cookie must be accessible on the WS upgrade request.
In the Docker single-nginx setup this is automatic — all traffic shares the same origin.

**Channel name safety:** Postgres channel names are case-sensitive and capped at 63 bytes.
`topic:<uuid>:message` is 44 chars — safe. Never interpolate arbitrary user input into
the channel name string passed to `LISTEN`/`UNLISTEN`.

**`pg` package vs `postgres`:** The bridge uses the `pg` npm package (node-postgres) because
it exposes the `notification` event on `Client`. The Kysely database uses a different pool.
Both can coexist; the bridge client is dedicated to LISTEN and never issues queries.
